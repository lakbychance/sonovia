import { UAParser } from 'ua-parser-js';

export const isSafariBrowser = (userAgent: string) => {
    const parser = new UAParser(userAgent);
    return parser.getBrowser().name === 'Safari' ||
        parser.getOS().name === 'iOS';
};

export const isSafariApp = (userAgent: string) => {
    const parser = new UAParser(userAgent);
    return parser.getOS().name === 'iOS';
};

