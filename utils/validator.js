import { parse, format } from 'date-fns'

export const dateValidator = (tanggal) => {
    const possibleFormats = [
        'dd/MM/yyyy',
        'dd-MM-yyyy',
        'MMMM d yyyy',
        'yyyy MMMM d',
        'yyyy-MM-dd',
        'MM/dd/yyyy',
        'd MMMM yyyy'
    ];

    for (const fmt of possibleFormats) {
        const parsedDate = parse(tanggal, fmt, new Date());
        if (!isNaN(parsedDate)) {
            return format(parsedDate, 'dd MMMM yyyy');
        }
    }
    return tanggal;
}

export const numberValidator = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/[.,-]/g, '');
}

export const parseText = (text) => {
    // Ambil NPWP
    const npwpMatches = text.match(/\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d+/g) || [];
    const npwpPenjual = numberValidator(npwpMatches[0]) || null;
    const npwpPembeli = numberValidator(npwpMatches[1]) || null;

    // Nama Penjual
    const namaPenjualMatch = text.match(/Nama Penjual.*?:\s*(.+?)\s*Alamat/i);
    const namaPenjual = namaPenjualMatch ? namaPenjualMatch[1].trim() : null;

    // Nama Pembeli
    const namaPembeliMatch = text.match(/Nama\s*:\s*(.+?)\s*NIK\/Paspor/i);
    const namaPembeli = namaPembeliMatch ? namaPembeliMatch[1].trim() : null;

    // Nomor Faktur
    const nomorFakturMatch = text.match(/Faktur Pajak:\s*(\d{3}\.\d{3}-\d{2}\.\d+)/i);
    const nomorFaktur = nomorFakturMatch ? numberValidator(nomorFakturMatch[1].replace(/\D/g, '')) : null;

    // Tanggal Faktur
    const tanggalFakturMatch = text.match(/tanggal Faktur:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
    const tanggalFaktur = tanggalFakturMatch ? dateValidator(tanggalFakturMatch[1].trim()) : null;

    // Jumlah DPP
    const dppMatch = text.match(/Dasar Pengenaan Pajak\s*:?[\sRp]*([\d.,]+)/i);
    const jumlahDpp = dppMatch ? dppMatch[1].split(',')[0].replace(/\./g, '') : null;

    // Jumlah PPN
    const ppnMatch = text.match(/Total PPN\s*:?[\sRp]*([\d.,]+)/i);
    const jumlahPpn = ppnMatch ? ppnMatch[1].split(',')[0].replace(/\./g, '') : null;

    return {
        "NPWP Penjual": npwpPenjual,
        "Nama Penjual": namaPenjual,
        "NPWP Pembeli": npwpPembeli,
        "Nama Pembeli": namaPembeli,
        "Nomor Faktur": nomorFaktur,
        "Tanggal Faktur": tanggalFaktur,
        "Jumlah DPP": jumlahDpp ? parseInt(jumlahDpp, 10) : null,
        "Jumlah PPN": jumlahPpn ? parseInt(jumlahPpn, 10) : null,
    };
}