import re

# Read the file
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the search-container div (lines 20-23)
content = re.sub(
    r'            <div class="search-container">.*?</div>\s*\n\s*\n',
    '',
    content,
    flags=re.DOTALL
)

# Replace search.html with discovery.html
content = content.replace('search.html', 'discovery.html')

# Write back
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated index.html")
