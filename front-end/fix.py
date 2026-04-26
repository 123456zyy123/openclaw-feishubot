import re
file_path = 'D:\\新建文件夹\\IntelliCodeAssistant\\preview_server.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('const html = context.pageHtml || fallbackBody;', 'const html = context.pageHtml || buildPreviewHtml({}).split(\'srcdoc="\')[1].split(\'" sandbox\')[0].replace(/&quot;/g, \'\\"\');')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
