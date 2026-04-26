import re

file_path = 'D:\\新建文件夹\\IntelliCodeAssistant\\preview_server.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

preview_route = '''    if (method === "GET" && requestUrl.pathname === "/") {
      const html = buildPreviewHtml({
        requirement: requirementText,
        pageHtml: context.pageHtml,
        runResult: context.runResult,
      });
      sendHtml(response, 200, html);
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/preview") {
      const html = context.pageHtml || fallbackBody;
      sendHtml(response, 200, html);
      return;
    }'''

content = re.sub(
    r'    if \(method === \"GET\" && requestUrl\.pathname === \"/\"\) \{\n      const html = buildPreviewHtml\(\{\n        requirement: requirementText,\n        pageHtml: context\.pageHtml,\n        runResult: context\.runResult,\n      \}\);\n      sendHtml\(response, 200, html\);\n      return;\n    \}',
    preview_route,
    content,
    flags=re.DOTALL
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Route added")
