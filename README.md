# calview

A calendar visualizer that parses `.ics` files, geocodes event locations, and displays a time-aware schedule with commutes.

## Repo overview

- **Frontend**: React 19, Vite, Tailwind CSS, Mapbox GL JS
- **Backend**: FastAPI, SQLModel, PostgreSQL, Google Maps API
- **Infrastructure**: AWS (S3, CloudFront, EC2) via CI/CD pipelines.

> For a complete breakdown of the system design, data flow, and infrastructure diagrams, please refer to [ARCHITECTURE.md](ARCHITECTURE.md).

### Features

- Upload and parse `.ics` calendar files
- Geocode event locations
- Visualize daily schedules with estimated commute times
- Share schedules via unique links

## Development setup

### Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend setup

```bash
cd ../frontend
npm install
npm run dev
```

### Extension setup

During development, compile Tailwind CSS into `styles.css` with:

```bash
cd ../extension
npm install
npx tailwindcss -i ./tailwind.css -o ./styles.css --minify --watch
```

To run this extension in Chrome, open `chrome://extensions`, enable Developer Mode, and click Load unpacked to select the `extension/` folder. Firefox is not supported. Only `popup.html`, `popup.js`, `styles.css`, and `manifest.json` are needed to run the extension.

### Environment variables

Create a .env file in both `backend/` and `frontend/` based on .env.example.

### Database

A Postgres database is required for development. Make sure to set the `DATABASE_URL` in your `backend/.env` file. You can run Postgres locally using the provided `docker-compose.yml`:

```bash
# Start a local Postgres instance
docker compose up -d

# Stop and remove the instance and its data
docker compose down --volumes
```

If `DATABASE_URL` is not set, the app falls back to a local SQLite database at `app/database.db`, with no setup required.

### Feedback

We are actively iterating based on user needs.
- Try it out: https://calview.me
- Contact: Submit feedback via the form on the website or open a GitHub issue.
