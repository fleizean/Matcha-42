#!/bin/bash
set -e

# Run the populate script inside the backend container
echo "Veritabanı test kullanıcıları ile dolduruluyor..."
docker-compose exec backend python populate.py
echo "İşlem tamamlandı!"
