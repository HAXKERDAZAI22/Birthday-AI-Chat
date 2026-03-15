// Simplified type annotations in ai.ts

import { Router } from 'express';

const router = Router();

router.get('/endpoint', (req, res) => {
    // Handling request and response without explicit Response type
    res.json({ message: 'Hello world!' });
});

export default router;