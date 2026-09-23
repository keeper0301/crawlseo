import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: "bash",
    args: [
      "-lc",
      "cd /home/user/.hermes/workspace/mcp-servers/crawlseo && set -a && [ -f .env ] && . ./.env; [ -f .env.local ] && . ./.env.local; set +a && exec npx tsx mcp/server.ts",
    ],
  });

  const client = new Client({ name: "crawlseo-smoke", version: "1.0.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log(`tools=${tools.tools.length}`);
  const list = await client.callTool({ name: "list_sites", arguments: {} });
  console.log(JSON.stringify(list.content, null, 2));

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
