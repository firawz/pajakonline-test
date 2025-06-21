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
