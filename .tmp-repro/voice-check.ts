import { VoiceService } from '../src/voice';

(async () => {
    const v = new VoiceService('win32');
    console.log('STT didukung:', v.systemSttSupported());
    const cat = await v.listVoices(true);
    console.log('jumlah suara:', cat.voices.length);
    cat.voices.slice(0, 10).forEach((x) => console.log(' -', x.name, '|', x.culture, '|', x.gender));
    console.log('pengenal ucapan:', JSON.stringify(cat.recognizers));

    console.log('--- mendengar 4 detik (tanpa bicara, harap tunggu) ---');
    const r = await v.recognize({ seconds: 4, culture: 'id-ID' });
    console.log('hasil dengar:', JSON.stringify(r));

    console.log('--- bicara singkat (volume rendah) ---');
    const h = v.speak({ text: 'Halo, ini tes suara Date Skunder.', rate: 1, volume: 0.2 });
    await h.done;
    console.log('bicara selesai');
})().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
