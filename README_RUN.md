# Running Campus Connect Lite

1. Open Terminal.
2. Navigate to project folder: `cd c:/Users/yaswa/OneDrive/Documents/23bq1a05e0/e2e`
3. Install dependencies (if not already): `npm install`
4. Make sure MongoDB is running locally on port 27017.
5. Start the server:
   ```bash
   node server.js
   ```
   (Or `npm start` if script is set up, but `node server.js` is direct)
6. Open Browser to `http://localhost:5000`

## Features
- **Student**: Sign up, Login, View Events, Register, Comment.
- **Club**: Sign up (select Club), Create Event, Upload Poster, AI Analyzer, 2D Planner.
- **Admin**: Sign up (select Admin or manual DB entry), View Users, Verify Clubs.

## Notes
- "Verified" status for clubs is required for some logic but currently loose in the UI to allow easy testing.
- AI Analyzer is a simulation.
