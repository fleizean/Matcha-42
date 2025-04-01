import os
import uuid
import httpx
from app.core.config import settings

async def save_profile_image_from_url(conn, profile_id, image_url):
    """
    Downloads and saves an image from a URL as a profile picture
    
    Args:
        conn: Database connection
        profile_id: Profile ID to associate the image with
        image_url: URL of the image to download
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create upload directory
        upload_dir = os.path.join(settings.MEDIA_ROOT, "profile_pictures", str(profile_id))
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate filename and save file
        file_ext = os.path.splitext(image_url)[1].lower() or ".jpg"
        if file_ext not in [".jpg", ".jpeg", ".png", ".gif"]:
            file_ext = ".jpg"  # Default to jpg
            
        filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(upload_dir, filename)
        
        # Download image
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url)
            if response.status_code == 200:
                with open(file_path, "wb") as buffer:
                    buffer.write(response.content)
                
                # Save to database
                relative_path = os.path.relpath(file_path, start=os.path.dirname(settings.MEDIA_ROOT))
                backend_url = f"{settings.BACKEND_URL}/{relative_path.replace(os.sep, '/')}"
                
                await conn.execute("""
                INSERT INTO profile_pictures (profile_id, file_path, backend_url, is_primary)
                VALUES ($1, $2, $3, true)
                """, profile_id, relative_path, backend_url)
                
                return True
        
        return False
    except Exception as e:
        print(f"Error saving profile image: {str(e)}")
        return False