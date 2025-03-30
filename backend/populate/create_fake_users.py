import os
from dotenv import load_dotenv
from pathlib import Path
import requests
import time
from faker import Faker
import asyncpg
from datetime import datetime, timedelta, timezone
import random
import glob
import uuid
from app.core.security import get_password_hash
from app.core.config import settings

# Load .env file
load_dotenv()

# Add the parent directory to Python path so we can import from app
MEDIA_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "media")

fake = Faker(['tr_TR'])

# Database connection using env variable
DATABASE_URL = os.getenv('DATABASE_URL')

# Örnek tag listesi
SAMPLE_TAGS = [
    "seyahat", "spor", "müzik", "sinema", "kitap", "yemek", "dans", 
    "fotoğraf", "yoga", "doğa", "kamp", "kahve", "teknoloji", "sanat",
    "tiyatro", "konser", "bisiklet", "koşu", "yüzme", "futbol"
]

# Örnek biyografiler
BIO_TEMPLATES = [
    "{}. {} için buradayım.",
    "Hayatta en çok sevdiğim şey {}. {} konusunda tutkulum var.",
    "{} ve {} ile ilgileniyorum.",
    "Boş zamanlarımda {} yapmayı seviyorum. {} ile aram çok iyi.",
]

def get_existing_profile_pictures():
    """Find all existing profile pictures in the media directory"""
    pictures_dir = os.path.join(MEDIA_ROOT, "profile_pictures")
    
    # Check if directory exists
    if not os.path.exists(pictures_dir):
        print(f"Warning: Directory {pictures_dir} does not exist")
        return []
    
    # Get all directories containing pictures
    profile_dirs = [d for d in os.listdir(pictures_dir) 
                    if os.path.isdir(os.path.join(pictures_dir, d))]
    
    # Dictionary to store profile IDs and their picture paths
    profile_pictures = {}
    
    for profile_dir in profile_dirs:
        full_dir_path = os.path.join(pictures_dir, profile_dir)
        # Find all image files in the directory
        image_files = []
        for ext in ['*.jpg', '*.jpeg', '*.png']:
            image_files.extend(glob.glob(os.path.join(full_dir_path, ext)))
        
        if image_files:
            profile_pictures[profile_dir] = [os.path.basename(img) for img in image_files]
    
    return profile_pictures

def use_existing_profile_picture(profile_id, profile_pictures_dict):
    """Assign an existing profile picture to a new profile"""
    # If there are no profile directories with pictures, return False
    if not profile_pictures_dict:
        print("No existing profile pictures found")
        return False
    
    # Get a random profile ID from the existing ones
    source_profile_id = random.choice(list(profile_pictures_dict.keys()))
    
    # Get all pictures for this profile
    pictures = profile_pictures_dict[source_profile_id]
    
    if not pictures:
        return False
    
    # Create directory for the new profile if it doesn't exist
    profile_dir = os.path.join(MEDIA_ROOT, "profile_pictures", profile_id)
    Path(profile_dir).mkdir(parents=True, exist_ok=True)
    
    # Copy up to 3 random pictures (or all if less than 3)
    num_pics = min(len(pictures), random.randint(1, 3))
    selected_pics = random.sample(pictures, num_pics)
    
    source_dir = os.path.join(MEDIA_ROOT, "profile_pictures", source_profile_id)
    copied_files = []
    
    for i, pic_name in enumerate(selected_pics):
        source_path = os.path.join(source_dir, pic_name)
        dest_name = f"{i+1}{os.path.splitext(pic_name)[1]}"  # 1.jpg, 2.jpg, etc.
        dest_path = os.path.join(profile_dir, dest_name)
        
        # Copy the file
        try:
            with open(source_path, 'rb') as src_file:
                with open(dest_path, 'wb') as dest_file:
                    dest_file.write(src_file.read())
            copied_files.append(dest_name)
            print(f"Copied image {pic_name} to {profile_id}/{dest_name}")
        except Exception as e:
            print(f"Error copying image {pic_name}: {str(e)}")
    
    return copied_files

def download_ai_profile_picture(profile_id, index):
    """Download an AI-generated profile picture"""
    # Create directory if it doesn't exist
    profile_dir = os.path.join(MEDIA_ROOT, "profile_pictures", profile_id)
    Path(profile_dir).mkdir(parents=True, exist_ok=True)
    
    # Define file path
    file_name = f"{index+1}.jpg"
    file_path = os.path.join(profile_dir, file_name)
    
    try:
        # Get a random AI-generated face from thispersondoesnotexist.com
        # This site serves a new random face on each request
        response = requests.get('https://thispersondoesnotexist.com/', stream=True)
        
        if response.status_code == 200:
            # Save the image
            with open(file_path, 'wb') as f:
                f.write(response.content)
            print(f"Downloaded AI image for {profile_id}/{file_name}")
            return True
        else:
            print(f"Failed to download AI image: {response.status_code}")
            return False
    except Exception as e:
        print(f"Error downloading AI image: {str(e)}")
        return False

def remove_turkish_chars(text):
    """
    Türkçe karakterleri İngilizce karşılıklarına dönüştürür
    ç -> c, ı -> i, ğ -> g, ş -> s, ö -> o, ü -> u
    """
    replacements = {
        'ç': 'c', 'Ç': 'C',
        'ı': 'i', 'İ': 'I',
        'ğ': 'g', 'Ğ': 'G',
        'ş': 's', 'Ş': 'S',
        'ö': 'o', 'Ö': 'O',
        'ü': 'u', 'Ü': 'U'
    }
    
    for tr_char, en_char in replacements.items():
        text = text.replace(tr_char, en_char)
    
    return text

async def create_fake_users_with_existing_pictures(count=50):
    # Get existing profile pictures
    existing_profile_pictures = get_existing_profile_pictures()
    
    # Connect to database
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        users_created = 0
        
        for _ in range(count):
            async with conn.transaction():
                # Basic user information
                first_name = fake.first_name()
                last_name = fake.last_name()
                
                first_name_safe = remove_turkish_chars(first_name)
                
                username = f"{first_name_safe.lower()}{fake.random_number(digits=4)}"
                email = f"{username}@{fake.domain_name()}"
                password = "password123"  # Same password for all test users
                print("Creating user: ", username)
                # Create user
                user_id = str(uuid.uuid4())
                now = datetime.now(timezone.utc)
                is_online = random.choice([True, False])
                last_online = now - timedelta(minutes=random.randint(1, 1440))
                
                user_id = await conn.fetchval("""
                INSERT INTO users (id, username, email, first_name, last_name, 
                                  hashed_password, is_active, is_verified, 
                                  created_at, is_online, last_online)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id
                """, user_id, username, email, first_name, last_name, 
                get_password_hash(password), True, True, 
                now, is_online, last_online)
                
                # Create profile
                profile_id = str(uuid.uuid4())
                genders = ['male', 'female', 'non_binary', 'other']
                preferences = ['heterosexual', 'homosexual', 'bisexual', 'other']
                
                gender = random.choice(genders)
                sexual_preference = random.choice(preferences)
                biography = random.choice(BIO_TEMPLATES).format(
                    random.choice(SAMPLE_TAGS),
                    random.choice(SAMPLE_TAGS)
                )
                latitude = float(fake.latitude())
                longitude = float(fake.longitude())
                fame_rating = random.uniform(0, 5)
                birth_date = fake.date_of_birth(minimum_age=18, maximum_age=50)
                
                await conn.execute("""
                INSERT INTO profiles (id, user_id, gender, sexual_preference, biography,
                                     latitude, longitude, fame_rating, is_complete, birth_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """, profile_id, user_id, gender, sexual_preference, biography,
                latitude, longitude, fame_rating, True, birth_date)
                
                # Use existing profile pictures
                copied_pics = use_existing_profile_picture(profile_id, existing_profile_pictures)
                
                if copied_pics:
                    for i, pic_name in enumerate(copied_pics):
                        # Add to database
                        await conn.execute("""
                        INSERT INTO profile_pictures (profile_id, file_path, backend_url, is_primary)
                        VALUES ($1, $2, $3, $4)
                        """, profile_id,
                        f"profile_pictures/{profile_id}/{pic_name}",
                        f"{settings.BACKEND_URL}/media/profile_pictures/{profile_id}/{pic_name}",
                        i == 0)
                
                # Add tags
                profile_tags = random.sample(SAMPLE_TAGS, random.randint(2, 5))
                for tag_name in profile_tags:
                    # Check if tag exists
                    tag_id = await conn.fetchval("SELECT id FROM tags WHERE name = $1", tag_name)
                    
                    if not tag_id:
                        # Create new tag
                        tag_id = await conn.fetchval("""
                        INSERT INTO tags (name) VALUES ($1) RETURNING id
                        """, tag_name)
                    
                    # Add tag to profile
                    await conn.execute("""
                    INSERT INTO profile_tags (profile_id, tag_id)
                    VALUES ($1, $2) ON CONFLICT DO NOTHING
                    """, profile_id, tag_id)
            
            users_created += 1
            if users_created % 10 == 0:
                print(f"Created {users_created} users...")
        
        print(f"{users_created} fake users successfully created!")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        raise
    finally:
        await conn.close()

async def create_fake_users_with_ai_pictures(count=50):
    # Connect to database
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        users_created = 0
        
        for _ in range(count):
            async with conn.transaction():
                # Basic user information
                first_name = fake.first_name()
                last_name = fake.last_name()
                
                first_name_safe = remove_turkish_chars(first_name)
                
                username = f"{first_name_safe.lower()}_{fake.random_number(digits=4)}"
                email = f"{username}@{fake.domain_name()}"
                password = "password123"  # Same password for all test users
                
                # Create user
                user_id = str(uuid.uuid4())
                now = datetime.now(timezone.utc)
                is_online = random.choice([True, False])
                last_online = now - timedelta(minutes=random.randint(1, 1440))
                
                user_id = await conn.fetchval("""
                INSERT INTO users (id, username, email, first_name, last_name, 
                                  hashed_password, is_active, is_verified, 
                                  created_at, is_online, last_online)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id
                """, user_id, username, email, first_name, last_name, 
                get_password_hash(password), True, True, 
                now, is_online, last_online)
                
                # Create profile
                profile_id = str(uuid.uuid4())
                genders = ['male', 'female', 'non_binary', 'other']
                preferences = ['heterosexual', 'homosexual', 'bisexual', 'other']
                
                gender = random.choice(genders)
                sexual_preference = random.choice(preferences)
                biography = random.choice(BIO_TEMPLATES).format(
                    random.choice(SAMPLE_TAGS),
                    random.choice(SAMPLE_TAGS)
                )
                latitude = float(fake.latitude())
                longitude = float(fake.longitude())
                fame_rating = random.uniform(0, 5)
                birth_date = fake.date_of_birth(minimum_age=18, maximum_age=50)
                
                await conn.execute("""
                INSERT INTO profiles (id, user_id, gender, sexual_preference, biography,
                                     latitude, longitude, fame_rating, is_complete, birth_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """, profile_id, user_id, gender, sexual_preference, biography,
                latitude, longitude, fame_rating, True, birth_date)
                
                # Add AI-generated profile pictures
                for i in range(random.randint(1, 3)):
                    # Download AI-generated photo
                    success = download_ai_profile_picture(profile_id, i)
                    
                    # Only add to database if download was successful
                    if success:
                        await conn.execute("""
                        INSERT INTO profile_pictures (profile_id, file_path, backend_url, is_primary)
                        VALUES ($1, $2, $3, $4)
                        """, profile_id, 
                        f"profile_pictures/{profile_id}/{i+1}.jpg",
                        f"{settings.BACKEND_URL}/media/profile_pictures/{profile_id}/{i+1}.jpg",
                        i == 0)
                    
                    # Add a small delay to avoid overloading the service
                    time.sleep(0.5)
                
                # Add tags
                profile_tags = random.sample(SAMPLE_TAGS, random.randint(2, 5))
                for tag_name in profile_tags:
                    # Check if tag exists
                    tag_id = await conn.fetchval("SELECT id FROM tags WHERE name = $1", tag_name)
                    
                    if not tag_id:
                        # Create new tag
                        tag_id = await conn.fetchval("""
                        INSERT INTO tags (name) VALUES ($1) RETURNING id
                        """, tag_name)
                    
                    # Add tag to profile
                    await conn.execute("""
                    INSERT INTO profile_tags (profile_id, tag_id)
                    VALUES ($1, $2) ON CONFLICT DO NOTHING
                    """, profile_id, tag_id)
            
            users_created += 1
            if users_created % 10 == 0:
                print(f"Created {users_created} users...")
        
        print(f"{users_created} fake users successfully created!")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    import asyncio
    
    # Choose which function to run based on your needs
    asyncio.run(create_fake_users_with_existing_pictures(250))
    # or
    # asyncio.run(create_fake_users_with_ai_pictures(200))