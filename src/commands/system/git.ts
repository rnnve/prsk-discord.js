import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import * as child_process from "node:child_process";
import { EmbedBuilder } from "../../utils/embed-builder.js";

const REMOTE_CHOICES = [
  { name: "GitHub", value: "origin" },
];

const REMOTE_LABELS: Record<string, string> = {
  origin: "GitHub",
};

const DEFAULT_REPO = { host: "github.com", repoPath: "cltq/prsk-discord.js" };

type RepoInfo = { host: string; repoPath: string };

const MAX_LOG_LENGTH = 900;

function hasGitRepo(): boolean {
  try {
    child_process.execSync("git rev-parse --is-inside-work-tree", {
      timeout: 5000,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

function parseRemoteUrl(url: string): RepoInfo | null {
  const raw = url.replace(".git", "");
  let parts: string[];
  let host: string;
  if (raw.startsWith("https://")) {
    parts = raw.split("/");
    host = parts[2] ?? "";
  } else if (raw.includes(":") && raw.includes("@")) {
    parts = raw.split(":")[1].split("/");
    host = raw.split("@")[1].split(":")[0] ?? "";
  } else {
    return null;
  }
  if (parts.length >= 2 && host) {
    return {
      repoPath: `${parts[parts.length - 2]}/${parts[parts.length - 1]}`,
      host,
    };
  }
  return null;
}

function remoteInfo(remote: string): RepoInfo | null {
  if (hasGitRepo()) {
    try {
      const url = child_process
        .execSync(`git remote get-url ${remote}`, { timeout: 10000 })
        .toString()
        .trim();
      const parsed = parseRemoteUrl(url);
      if (parsed) return parsed;
    } catch {
      // fall through to default
    }
  }
  return DEFAULT_REPO;
}

function gitLog(remote: string, allCommits: boolean): string {
  const count = allCommits ? "" : " -5";
  const branches = [`${remote}/main`, `${remote}/master`, "HEAD"];
  for (const ref of branches) {
    try {
      const result = child_process
        .execSync(`git log ${ref} --oneline --no-merges${count}`, {
          timeout: 15000,
        })
        .toString()
        .trim();
      const lines = result.split("\n").filter(Boolean);
      if (!lines.length) continue;
      return lines.map((line, i) => `${i + 1}. ${line}`).join("\n");
    } catch {
      // try next branch
    }
  }
  return "";
}

async function apiLog(repo: RepoInfo, allCommits: boolean): Promise<string> {
  const perPage = allCommits ? 100 : 5;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo.repoPath}/commits?per_page=${perPage}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "prsk-discord.js",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok) return "(failed to fetch log)";
    const commits = (await res.json()) as Array<{
      sha: string;
      commit: { message: string };
    }>;
    if (!Array.isArray(commits) || commits.length === 0) return "(no commits found)";
    return commits
      .map((c, i) => `${i + 1}. ${c.sha.slice(0, 7)} ${c.commit.message.split("\n")[0]}`)
      .join("\n");
  } catch {
    return "(failed to fetch log)";
  }
}

function truncateLog(log: string): string {
  if (log.length <= MAX_LOG_LENGTH) return log;
  const cut = log.slice(0, MAX_LOG_LENGTH);
  const lastNewline = cut.lastIndexOf("\n");
  return `${cut.slice(0, lastNewline)}\n… (truncated)`;
}

async function fetchLog(remote: string, allCommits: boolean): Promise<string> {
  if (hasGitRepo()) {
    try {
      child_process.execSync(`git fetch --quiet ${remote}`, { timeout: 15000 });
    } catch {
      // fetch failed — fall back to local log
    }
    const local = gitLog(remote, allCommits);
    if (local) return local;
  }
  const repo = remoteInfo(remote);
  if (repo) {
    const viaApi = await apiLog(repo, allCommits);
    if (viaApi) return viaApi;
  }
  return "(failed to fetch log)";
}

export default {
  data: new SlashCommandBuilder()
    .setName("git")
    .setDescription("ดู commits จาก GitHub")
    .setDMPermission(true)
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1)
    .addStringOption((opt) =>
      opt
        .setName("remote")
        .setDescription("เลือก remote ที่ต้องการดู commits")
        .setRequired(true)
        .addChoices(...REMOTE_CHOICES)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("all")
        .setDescription("แสดงทั้งหมด (true) หรือแค่ 5 ล่าสุด (false, default)")
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("ephemeral")
        .setDescription("ตอบกลับแบบส่วนตัว (default: false)")
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const remote = interaction.options.getString("remote", true);
    const all = interaction.options.getBoolean("all") ?? false;
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;

    await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });

    const embed = EmbedBuilder.hex("#F05032", "📋 Git Log");
    embed.setFooter({ text: `Requested by ${interaction.user.displayName}` });

    const log = truncateLog(await fetchLog(remote, all));
    const label = REMOTE_LABELS[remote] ?? remote;
    const info = remoteInfo(remote);

    if (info) {
      const url = `https://${info.host}/${info.repoPath}`;
      embed.addInlineField(
        `🔗 ${label} — ${info.repoPath}`,
        `[\`${info.repoPath}\`](${url})\n\`\`\`${log}\`\`\``,
        false,
      );
    } else {
      embed.addInlineField(`🔗 ${label}`, `\`\`\`${log}\`\`\``, false);
    }

    await interaction.followUp({ embeds: [embed.toJSON()], flags: ephemeral ? MessageFlags.Ephemeral : undefined });
  },
};
