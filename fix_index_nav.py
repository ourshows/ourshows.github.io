with open('d:/ourshow/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Home link with Discover link
old_line = '                <li><a href="index.html" class="nav-link active"><i class="fas fa-home"></i> Home</a></li>'
new_line = '                <li><a href="discovery.html" class="nav-link"><i class="fas fa-search"></i> Discover</a></li>'

content = content.replace(old_line, new_line)

with open('d:/ourshow/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ index.html updated - replaced Home with Discover!")
