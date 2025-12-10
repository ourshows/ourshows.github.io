import re

# Read collection.html
with open('d:/ourshow/collection.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the old navbar pattern (lines 121-139)
old_navbar = r'''    <nav class="navbar" id="navbar">
        <div class="container nav-content">
            <a href="index.html" class="logo">OurShow</a>

            <button class="mobile-menu-btn" id="mobileMenuBtn">
                <i class="fas fa-bars"></i>
            </button>

            <ul class="nav-links" id="navLinks">
                <li><a href="index.html" class="nav-link"><i class="fas fa-home"></i> <span>Home</span></a></li>
                <li><a href="discovery.html" class="nav-link"><i class="fas fa-search"></i> <span>Search</span></a></li>
                <li><a href="collection.html" class="nav-link active"><i class="fas fa-layer-group"></i>
                        <span>Collections</span></a></li>
                <li><a href="ai.html" class="nav-link"><i class="fas fa-robot"></i> <span>AI Vibe</span></a></li>
                <li><a href="post.html" class="nav-link"><i class="fas fa-users"></i> <span>Feed</span></a></li>
                <li><a href="profile.html" class="nav-link"><i class="fas fa-user"></i> <span>Profile</span></a></li>
            </ul>
        </div>
    </nav>'''

# Define the new simple navbar
new_navbar = '''    <nav class="navbar">
        <div class="container nav-content">
            <a href="index.html" class="logo">OurShow</a>
            <ul class="nav-links">
                <li><a href="index.html" class="nav-link"><i class="fas fa-home"></i> Home</a></li>
            </ul>
        </div>
    </nav>'''

# Replace
content = content.replace(old_navbar, new_navbar)

# Write back
with open('d:/ourshow/collection.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ collection.html updated successfully!")
