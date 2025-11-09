import supertest from 'supertest';

export const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';
export const api = supertest(API_BASE);

// tiny wait utility
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
