# Getting Started with Matcha

This guide will help you set up and run the Matcha dating website application.

## Backend Setup

### 1. Create Directory Structure

```bash
mkdir -p matcha/backend/app/{api,core,models,schemas,services,templates/email}
mkdir -p matcha/backend/alembic/versions
mkdir -p matcha/backend/media/profile_pictures
```

### 2. Install Dependencies

Create a virtual environment and install the required packages:

```bash
cd matcha/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the backend directory:

```
# Database settings
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/matcha

# JWT settings
SECRET_KEY=your_super_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email settings
MAIL_USERNAME=your_email@example.com
MAIL_PASSWORD=your_email_password
MAIL_FROM=no-reply@matcha.com
MAIL_PORT=587
MAIL_SERVER=smtp.example.com
MAIL_TLS=True
MAIL_SSL=False

# Admin user (created on first run)
FIRST_SUPERUSER=admin@matcha.com
FIRST_SUPERUSER_PASSWORD=admin_password

# Frontend URL (for links in emails)
FRONTEND_URL=http://localhost:3000

# Media directory for uploads
MEDIA_ROOT=./media

# CORS settings (comma-separated list)
BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://localhost
```

### 4. Set Up the Database

Create the PostgreSQL database:

```bash
# Using psql
psql -c "CREATE DATABASE matcha;"

# Or using createdb
createdb matcha
```

### 5. Run Database Migrations

Initialize and run Alembic migrations:

```bash
alembic init alembic  # Only if alembic directory doesn't exist
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

### 6. Populate the Database

```bash
python -m populate.populate
```


### 7. Start the Backend Server

```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000, and the API documentation will be at http://localhost:8000/docs. Admin panel will be at http://localhost:8000/admin

## Testing the Backend

### Authentication Flow

1. Register a new user:

```bash
curl -X 'POST' \
  'http://localhost:8000/api/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{
  "email": "user@example.com",
  "username": "testuser",
  "password": "Password123",
  "first_name": "John",
  "last_name": "Doe"
}'
```

2. Check your email for verification link (or check the logs in development)

3. Log in:

```bash
curl -X 'POST' \
  'http://localhost:8000/api/auth/login/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "username": "testuser",
  "password": "Password123"
}'
```

4. Save the access token from the response for future authenticated requests

### Profile Management

1. Update your profile:

```bash
curl -X 'PUT' \
  'http://localhost:8000/api/profiles/me' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "gender": "male",
  "sexual_preference": "heterosexual",
  "biography": "I love hiking and photography.",
  "latitude": 40.7128,
  "longitude": -74.0060
}'
```

2. Add tags to your profile:

```bash
curl -X 'PUT' \
  'http://localhost:8000/api/profiles/me/tags' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "tags": ["hiking", "photography", "travel", "music"]
}'
```

3. Upload a profile picture (using a form with a file upload)

4. Get suggested profiles:

```bash
curl -X 'GET' \
  'http://localhost:8000/api/profiles/suggested' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

### Further Exploration

- Use the API documentation at http://localhost:8000/docs for exploring all available endpoints
- Experiment with WebSocket connections for real-time chat and notifications
- Test different matching criteria to see how the algorithm works

## Frontend Setup (To Be Implemented)

The frontend implementation will be based on Next.js. Instructions for setting up and running the frontend will be added once implemented.

## Development Tips

- Use [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/) for testing API endpoints
- Monitor the database using a tool like [pgAdmin](https://www.pgadmin.org/)
- For WebSocket testing, use a tool like [WebSocket King](https://websocketking.com/)