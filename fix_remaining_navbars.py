import re

# Fix post.html
with open('d:/ourshow/post.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_navbar = r'''    <nav class="navbar" id="navbar">
        <div class="container nav-content">
            <a href="index.html" class="logo">OurShow Feed</a>

            <button class="mobile-menu-btn" id="mobileMenuBtn">
                <i class="fas fa-bars"></i>
            </button>

            <ul class="nav-links" id="navLinks">
                <li><a href="index.html" class="nav-link"><i class="fas fa-home"></i> <span>Home</span></a></li>
                <li><a href="discovery.html" class="nav-link"><i class="fas fa-search"></i> <span>Search</span></a></li>
                <li><a href="collection.html" class="nav-link"><i class="fas fa-layer-group"></i>
                        <span>Collections</span></a></li>
                <li><a href="ai.html" class="nav-link"><i class="fas fa-robot"></i> <span>AI Vibe</span></a></li>
                <li><a href="post.html" class="nav-link active"><i class="fas fa-users"></i> <span>Feed</span></a></li>
                <li><a href="profile.html" class="nav-link"><i class="fas fa-user"></i> <span>Profile</span></a></li>
            </ul>
        </div>
    </nav>'''

new_navbar = '''    <nav class="navbar">
        <div class="container nav-content">
            <a href="index.html" class="logo">OurShow</a>
            <ul class="nav-links">
                <li><a href="index.html" class="nav-link"><i class="fas fa-home"></i> Home</a></li>
            </ul>
        </div>
    </nav>'''

content = content.replace(old_navbar, new_navbar)

with open('d:/ourshow/post.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ post.html updated successfully!")

# Fix profile.html
with open('d:/ourshow/profile.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_navbar = '''    <nav class="navbar">
        <div class="container nav-content">
            <a href="index.html" class="logo">OurShow</a>
            <a onclick="logout()" class="nav-link" style="cursor: pointer;"><i class="fas fa-sign-out-alt"></i>
                Logout</a>
        </div>
    </nav>'''

new_navbar = '''    <nav class="navbar">
        <div class="container nav-content">
            <a href="index.html" class="logo">OurShow</a>
            <ul class="nav-links">
                <li><a href="index.html" class="nav-link"><i class="fas fa-home"></i> Home</a></li>
            </ul>
        </div>
    </nav>'''

content = content.replace(old_navbar, new_navbar)

with open('d:/ourshow/profile.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ profile.html updated successfully!")
print("\n🎉 All secondary pages now have simple 'Home' button only!")
