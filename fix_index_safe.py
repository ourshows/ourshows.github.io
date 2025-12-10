import re

# Read the file
with open('d:/ourshow/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace the specific line
for i, line in enumerate(lines):
    if '<li><a href="index.html" class="nav-link active"><i class="fas fa-home"></i> Home</a></li>' in line:
        lines[i] = line.replace(
            '<li><a href="index.html" class="nav-link active"><i class="fas fa-home"></i> Home</a></li>',
            '<li><a href="discovery.html" class="nav-link"><i class="fas fa-search"></i> Discover</a></li>'
        )
        print(f"✅ Replaced line {i+1}: Home → Discover")
        break

# Write back
with open('d:/ourshow/index.html', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✅ index.html updated successfully!")
