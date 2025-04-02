import os
import asyncio
import uuid
import random
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
import asyncpg
from faker import Faker
from pathlib import Path
import shutil
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/matcha")
MEDIA_ROOT = os.getenv("MEDIA_ROOT", "./media")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
FACES_DIR = "downloaded_faces"  # Directory containing the downloaded face images
FAKE_PASSWORD = "CrushIt123!"  # Same password for all test users
BATCH_SIZE = 25  # Process users in batches for better performance

# Initialize Faker
fake = Faker(['tr_TR'])

# Sample tag list
SAMPLE_TAGS = [
    "seyahat", "spor", "müzik", "sinema", "kitap", "yemek", "dans", 
    "fotoğraf", "yoga", "doğa", "kamp", "kahve", "teknoloji", "sanat",
    "tiyatro", "konser", "bisiklet", "koşu", "yüzme", "futbol",
    "gitar", "piyano", "resim", "heykel", "yazılım", "moda", "mimari",
    "tarih", "bilim", "felsefe", "psikoloji", "yabancı-dil", "siyaset",
    "ekonomi", "eğitim", "sağlık", "hayvanlar", "çevre", "bahçecilik",
    "dekorasyon", "mühendislik", "uzay", "astronomi", "yaratıcı-yazı",
    "şiir", "roman", "anime", "manga", "oyun", "satranç", "bulmaca"
]

# Sample biography templates
BIO_TEMPLATES = [
    "{} ve {} ile ilgileniyorum. Hayatımda {} önemli bir yer tutuyor.",
    "{}. {} konusunda tutkulum var. Boş zamanlarımda {} yapıyorum.",
    "Hayatta en çok sevdiğim şey {}. {} ve {} ile ilgileniyorum.",
    "{} yapmayı seviyorum. {} konusunda kendimi geliştiriyorum. {} hakkında konuşmayı severim.",
    "{} tutkunu biriyim. {} ve {} hakkında konuşabiliriz.",
    "Kendimi {} konusunda geliştirmeye çalışıyorum. {} ve {} de ilgi alanlarım.",
    "{} hakkında her şeyi biliyorum desem yeridir. {} ve {} de hayatımın bir parçası.",
    "{}, {} ve {} hayatımın vazgeçilmezleri.",
    "{} yapmadan geçen bir günüm eksik sayılır. {} ve {} de ilgi alanlarım."
]

# Function to generate a secure password hash
def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_context.hash(password)

def remove_turkish_chars(text: str) -> str:
    """
    Replace Turkish characters with their English equivalents
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

async def copy_profile_picture(profile_id: str, image_file: str) -> str:
    """
    Copy an image to the profile directory and return its path
    """
    # Create profile directory
    profile_dir = os.path.join(MEDIA_ROOT, "profile_pictures", profile_id)
    os.makedirs(profile_dir, exist_ok=True)
    
    # Generate a unique filename
    file_ext = os.path.splitext(image_file)[1].lower() or ".jpg"
    filename = f"{uuid.uuid4()}{file_ext}"
    dest_path = os.path.join(profile_dir, filename)
    
    # Copy the image
    source_path = os.path.join(FACES_DIR, image_file)
    if not os.path.exists(source_path):
        return None
    
    shutil.copy2(source_path, dest_path)
    
    # Return relative path for database
    return os.path.join("profile_pictures", profile_id, filename)

def get_face_images() -> List[str]:
    """Get all image files from the faces directory"""
    if not os.path.exists(FACES_DIR):
        raise FileNotFoundError(f"Directory {FACES_DIR} not found")
    
    image_files = []
    for ext in ['*.jpg', '*.jpeg', '*.png', '*.gif']:
        #pattern = os.path.join(FACES_DIR, ext)
        image_files.extend([os.path.basename(p) for p in Path(FACES_DIR).glob(ext)])
    
    return image_files

async def create_users_batch(
    conn,
    batch: List[Dict[str, Any]],
    face_images: List[str],
    start_idx: int
) -> None:
    """Create a batch of users with profiles and pictures"""
    # Prepare hashed password once for all users
    hashed_password = get_password_hash(FAKE_PASSWORD)
    
    # Process each user in the batch
    for i, user_data in enumerate(batch):
        async with conn.transaction():
            # Create user
            user_id = str(uuid.uuid4())
            profile_id = str(uuid.uuid4())
            
            # Prepare username (without Turkish characters)
            first_name_safe = remove_turkish_chars(user_data["first_name"])
            last_name_safe = remove_turkish_chars(user_data["last_name"])
            username = f"{first_name_safe.lower()}_{last_name_safe.lower()}_{random.randint(100, 999)}"
            
            # Insert user
            await conn.execute("""
            INSERT INTO users (
                id, username, email, first_name, last_name, 
                hashed_password, is_active, is_verified, 
                created_at, is_online, last_online
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """, 
                user_id, 
                username,
                f"{username}@{fake.domain_name()}", 
                user_data["first_name"],
                user_data["last_name"],
                hashed_password,
                True,  # is_active
                True,  # is_verified
                datetime.now(timezone.utc),
                False,  # is_online
                user_data["last_online"]
            )
            
            # Insert profile
            await conn.execute("""
            INSERT INTO profiles (
                id, user_id, gender, sexual_preference, biography,
                latitude, longitude, fame_rating, is_complete, birth_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
                profile_id,
                user_id,
                user_data["gender"],
                user_data["sexual_preference"],
                user_data["biography"],
                user_data["latitude"],
                user_data["longitude"],
                user_data["fame_rating"],
                True,  # is_complete
                user_data["birth_date"]
            )
            
            # Copy profile picture
            image_idx = (start_idx + i) % len(face_images)
            image_file = face_images[image_idx]
            relative_path = await copy_profile_picture(profile_id, image_file)
            
            if relative_path:
                # Store profile picture in database
                await conn.execute("""
                INSERT INTO profile_pictures (
                    profile_id, file_path, backend_url, is_primary
                ) VALUES ($1, $2, $3, $4)
                """,
                    profile_id,
                    relative_path,
                    f"{BACKEND_URL}/media/{relative_path.replace(os.sep, '/')}",
                    True  # is_primary
                )
            
            # Add tags
            profile_tags = random.sample(SAMPLE_TAGS, random.randint(3, 7))
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
            
        # Log progress
        print(f"Created user {start_idx + i + 1}/500: {username}")

async def generate_fake_users(count: int = 500) -> None:
    """Generate fake users with profile pictures"""
    print(f"Generating {count} fake users...")
    
    # Get face images
    face_images = get_face_images()
    if not face_images:
        print("No face images found in the downloaded_faces directory!")
        return
    
    print(f"Found {len(face_images)} face images")
    
    # Connect to database
    print(f"Connecting to database: {DATABASE_URL}")
    conn = await asyncpg.connect(DATABASE_URL)
    print("Connected to database")
    
    try:
        # Prepare fake user data
        users_data = []
        
        now = datetime.now(timezone.utc)
        genders = ['male', 'female', 'non_binary', 'other']
        preferences = ['heterosexual', 'homosexual', 'bisexual', 'other']
        
        for _ in range(count):
            # Randomize user attributes
            gender = random.choice(genders)
            first_name = fake.first_name_male() if gender == 'male' else fake.first_name_female()
            last_name = fake.last_name()
            
            # Generate random date of birth (age 18-65)
            birth_date = fake.date_of_birth(minimum_age=18, maximum_age=65)
            
            # Generate a random last online timestamp (between 1 minute and 30 days ago)
            last_online = now - timedelta(minutes=random.randint(1, 43200))  # Up to 30 days ago
            
            # Generate a random biography using templates
            bio_template = random.choice(BIO_TEMPLATES)
            random_tags = random.sample(SAMPLE_TAGS, bio_template.count('{}'))
            biography = bio_template.format(*random_tags)
            
            # Generate profile data
            users_data.append({
                "first_name": first_name,
                "last_name": last_name,
                "gender": gender,
                "sexual_preference": random.choice(preferences),
                "biography": biography,
                "latitude": float(fake.latitude()),
                "longitude": float(fake.longitude()),
                "fame_rating": round(random.uniform(0, 5), 1),
                "birth_date": birth_date,
                "last_online": last_online
            })
        
        # Process users in batches
        for i in range(0, count, BATCH_SIZE):
            batch = users_data[i:i+BATCH_SIZE]
            await create_users_batch(conn, batch, face_images, i)
            print(f"Completed batch {i//BATCH_SIZE + 1}/{(count+BATCH_SIZE-1)//BATCH_SIZE}")
        
        print(f"Successfully created {count} users!")
        
    except Exception as e:
        print(f"Error generating users: {str(e)}")
        raise
    finally:
        await conn.close()
        print("Database connection closed")

if __name__ == "__main__":
    # Make sure the media directory exists
    os.makedirs(os.path.join(MEDIA_ROOT, "profile_pictures"), exist_ok=True)
    
    # Run the async function
    print("Starting user generation process...")
    asyncio.run(generate_fake_users(500))
    print("Done!")