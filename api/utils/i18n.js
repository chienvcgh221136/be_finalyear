const fs = require('fs');
const path = require('path');

// 1. Try to read from local 'server/locales' folder (for deployment)
let localesPath = path.join(__dirname, '../../locales');

// 2. If 'server/locales' doesn't exist, fallback to Mono-Repo mode
if (!fs.existsSync(localesPath)) {
    localesPath = path.join(__dirname, '../../../client/src/locales');
}

const translations = {};

const loadTranslations = () => {
    try {
        const languages = ['vi', 'en'];
        languages.forEach(lang => {
            const filePath = path.join(localesPath, lang, 'translation.json');
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                translations[lang] = JSON.parse(content);
            } else {
                console.warn(`[i18n] Translation file NOT found for ${lang} at ${filePath}`);
            }
        });
    } catch (error) {
        console.error('[i18n] Failed to load translations:', error);
    }
};

/**
 * Get nested object property by path string
 * @param {Object} obj 
 * @param {string} path 
 */
const getNestedValue = (obj, path) => {
    return path.split('.').reduce((prev, curr) => {
        return prev ? prev[curr] : undefined;
    }, obj);
};

/**
 * Simple t function for server-side translation
 * @param {string} key - e.g. 'admin.points.adjustment_reasons.violation_warning'
 * @param {string} lang - 'vi' or 'en'
 * @param {Object} data - data for interpolation {{var}}
 */
const t = (key, lang = 'vi', data = {}) => {
    if (!translations[lang]) {
        // Try to reload once if missing
        if (Object.keys(translations).length === 0) loadTranslations();
        if (!translations[lang]) return null;
    }

    let value = getNestedValue(translations[lang], key);

    if (value === undefined) {
        // Fallback to Vietnamese if not found in English
        if (lang !== 'vi') {
            value = getNestedValue(translations['vi'], key);
        }
        if (value === undefined) return null;
    }

    // Basic interpolation: replace {{var}} with data[var]
    if (typeof value === 'string') {
        Object.keys(data).forEach(dataKey => {
            const regex = new RegExp(`{{${dataKey}}}`, 'g');
            value = value.replace(regex, data[dataKey]);
        });
    }

    return value;
};

// Initial load
loadTranslations();

module.exports = {
    t,
    loadTranslations // Exported in case manual reload is needed (e.g. in dev)
};
