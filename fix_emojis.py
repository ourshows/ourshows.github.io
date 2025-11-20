import re

# Read the file with UTF-8 encoding
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Define ALL character replacements (garbled text -> proper character)
char_map = {
    # Special punctuation and symbols (do these first)
    'ΓÇö': '—',  # Em dash
    'ΓÇô': '–',  # En dash
    'ΓÇó': '•',  # Bullet
    'ΓÇ£': '"',  # Left double quote
    'ΓÇ¥': '"',  # Right double quote
    'ΓÇÖ': "'",  # Left single quote
    'ΓÇÿ': "'",  # Right single quote
    'ΓÇª': '…',  # Ellipsis
    'ΓÇ╣': '←',
    'ΓÇ¿': '→',
    'ΓÇ»': '↑',
    'ΓÇ╝': '↓',
    'Γ£à': '✅',
    'ΓÜá∩╕Å': '⚠️',
    'Γ¥î': '❌',
    
    # Garbled emojis
    '≡ƒÄ¼': '🎬',
    '≡ƒÆ¼': '💬',
    '≡ƒñû': '🤖',
    '≡ƒô¥': '📝',
    '≡ƒôÑ': '📥',
    '≡ƒÄ¢∩╕Å': '🎞️',
    '≡ƒÄ▓': '🎲',
    '≡ƒô▒': '📱',
    '≡ƒöö': '🔔',
    'Γ¡É': '⭐',
    'ΓÅ│': '⏳',
    'Γû╝': '▼',
    '≡ƒæñ': '👤',
    '≡ƒÜ¬': '🚪',
    'Γ£û': '✕',
    '≡ƒì┐': '🍿',
    'Γ£¿': '✨',
    '≡ƒÜÇ': '🚀',
    '≡ƒÄ¡': '🎭',
    '≡ƒô║': '📺',
    '≡ƒÄÑ': '🎥',
    '≡ƒÆí': '💡',
    '≡ƒÄ¬': '🎪',
    '≡ƒºá': '🎚️',
    'Γÿ░': '🏆',
    '≡ƒÅå': '🏅',
    '≡ƒöÄ': '🔍',
}

# Replace all garbled characters
for garbled, proper in char_map.items():
    content = content.replace(garbled, proper)

# Write back with UTF-8 encoding
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ All characters fixed successfully!")
print(f"📝 Replaced {len(char_map)} character patterns")
