import os
import asyncio
import httpx
import hashlib

def get_image_hash(image_data):
    """Returns a unique hash for the given image data."""
    return hashlib.md5(image_data).hexdigest()

async def download_image(client, url, folder, seen_hashes, index):
    try:
        response = await client.get(url, timeout=5)
        if response.status_code == 200:
            image_hash = get_image_hash(response.content)
            
            if image_hash in seen_hashes:
                print(f"Duplicate image detected, skipping {index+1}")
                return
            
            seen_hashes.add(image_hash)
            image_path = os.path.join(folder, f"person_{len(seen_hashes)}.jpg")
            with open(image_path, "wb") as file:
                file.write(response.content)
            print(f"Downloaded unique image {len(seen_hashes)}")
        else:
            print(f"Failed to download image {index+1}, Status Code: {response.status_code}")
    except httpx.RequestError as e:
        print(f"Error downloading image {index+1}: {e}")

async def download_images(folder: str, count: int = 500):
    """
    Downloads AI-generated faces from 'thispersondoesnotexist.com' while ensuring uniqueness.
    
    :param folder: The directory where images will be saved.
    :param count: The number of unique images to download.
    """
    if not os.path.exists(folder):
        os.makedirs(folder)
    
    url = "https://thispersondoesnotexist.com/"
    seen_hashes = set()
    
    async with httpx.AsyncClient() as client:
        index = 0
        while len(seen_hashes) < count:
            await download_image(client, url, folder, seen_hashes, index)
            index += 1

if __name__ == "__main__":
    asyncio.run(download_images(folder="downloaded_faces", count=500))
