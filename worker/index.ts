import { Hono } from 'hono';
import { audioRoutes } from './routes/audio';
import { tracksRoutes } from './routes/tracks';
import { weatherRoutes } from './routes/weather';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true, service: 'ambience' }));

app.route('/api/tracks', tracksRoutes);
app.route('/api/audio', audioRoutes);
app.route('/api/weather', weatherRoutes);

export default app;
