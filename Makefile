build:
	@docker-compose up --build

up:
	@docker-compose up

down:
	@docker-compose down

restart:
	@docker-compose restart

logs:
	@docker-compose logs -f

ps:
	@docker-compose ps

shell-backend:
	@docker-compose exec backend /bin/bash

shell-frontend:
	@docker-compose exec frontend /bin/sh

clean:
	@docker-compose down --volumes --remove-orphans