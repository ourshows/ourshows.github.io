import requests
import json

# TMDB API Configuration
# Replace with your actual API key from config.js
TMDB_API_KEY = "798ae7de540b25e908c68ea2ca408347"
TMDB_BASE_URL = "https://api.themoviedb.org/3"

def test_tmdb_api():
    print("=" * 50)
    print("TMDB API Test")
    print("=" * 50)
    print()
    
    # Test 1: Get Trending Movies
    print("Test 1: Fetching Trending Movies...")
    url = f"{TMDB_BASE_URL}/trending/movie/week"
    params = {
        "api_key": TMDB_API_KEY,
        "language": "en-US"
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS! Found {len(data.get('results', []))} trending movies")
            print()
            print("First 3 movies:")
            for i, movie in enumerate(data.get('results', [])[:3], 1):
                print(f"  {i}. {movie.get('title')} ({movie.get('release_date', 'N/A')[:4]})")
                print(f"     Rating: {movie.get('vote_average')}/10")
            print()
        elif response.status_code == 401:
            print("❌ ERROR: Invalid API Key")
            print("Please update TMDB_API_KEY in this script with your actual key from config.js")
        else:
            print(f"❌ ERROR: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network Error: {e}")
        print("Check your internet connection")
    
    print()
    
    # Test 2: Get Popular Movies
    print("Test 2: Fetching Popular Movies...")
    url = f"{TMDB_BASE_URL}/movie/popular"
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS! Found {len(data.get('results', []))} popular movies")
        else:
            print(f"❌ ERROR: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network Error: {e}")
    
    print()
    print("=" * 50)
    print("Test Complete!")
    print("=" * 50)
    print()
    print("If you see ✅ SUCCESS above, your TMDB API is working!")
    print("The issue is with the browser CORS policy, not the API.")
    print()
    print("SOLUTION: Run the site on http://localhost using START_SERVER.bat")

if __name__ == "__main__":
    if TMDB_API_KEY == "YOUR_API_KEY_HERE":
        print("⚠️  WARNING: Please update TMDB_API_KEY in this script first!")
        print()
        print("1. Open config.js")
        print("2. Copy your TMDB_API_KEY value")
        print("3. Paste it in this script where it says YOUR_API_KEY_HERE")
        print()
        input("Press Enter to exit...")
    else:
        test_tmdb_api()
        input("\nPress Enter to exit...")
