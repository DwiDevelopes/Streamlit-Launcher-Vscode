import { check, planTeks } from './e2e-test';

check('target ditebak dari kalimat', Boolean(planTeks?.steps.some((s) => s.goto === 'tg3')), JSON.stringify(planTeks?.steps.map((s) => s.goto)));