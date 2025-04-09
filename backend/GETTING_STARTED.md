## Backend Setup

### 1. Install Dependencies

Create a virtual environment and install the required packages:

```bash
cd matcha/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Set Up the Database

Create the PostgreSQL database:

```bash
# Using psql
psql -c "CREATE DATABASE matcha;"

# Or using createdb
createdb matcha
```

### 3. Populate the Database

```bash
python -m populate
```


### 4. Start the Backend Server

```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000, and the API documentation will be at http://localhost:8000/docs.


## Development Tips

- Use [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/) for testing API endpoints
- Monitor the database using a tool like [pgAdmin](https://www.pgadmin.org/)
- For WebSocket testing, use a tool like [WebSocket King](https://websocketking.com/)