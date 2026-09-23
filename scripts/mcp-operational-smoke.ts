import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const sites = ["site_blogfury", "site_keepioo", "site_peonchi"];

async function main() {
  const transport = new StdioClientTransport({
    command: "bash",
    args: [
      "-lc",
      "cd /home/user/.hermes/workspace/mcp-servers/crawlseo && set -a && [ -f .env ] && . ./.env; [ -f .env.local ] && . ./.env.local; set +a && exec npx tsx mcp/server.ts",
    ],
  });
  const client = new Client({ name: "crawlseo-operational-smoke", version: "1.0.0" });
  await client.connect(transport);

  const out: Record<string, unknown> = {};
  out.tools = (await client.listTools()).tools.map((t) => t.name);
  out.list_sites = (await client.callTool({ name: "list_sites", arguments: {} })).content;
  for (const siteId of sites) {
    out[`${siteId}:overview`] = (await client.callTool({ name: "get_site_overview", arguments: { siteId } })).content;
    out[`${siteId}:keywords`] = (await client.callTool({ name: "get_keywords", arguments: { siteId, limit: 3 } })).content;
    out[`${siteId}:pages`] = (await client.callTool({ name: "get_pages", arguments: { siteId, limit: 3 } })).content;
    out[`${siteId}:opportunities`] = (await client.callTool({ name: "get_opportunities", arguments: { siteId } })).content;
  }

  console.log(JSON.stringify(out, null, 2));
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
