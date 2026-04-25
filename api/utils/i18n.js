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
                console.log(`[i18n] Loaded ${lang} from: ${filePath}`);
                console.log(`[i18n] Top level keys for ${lang}: ${Object.keys(translations[lang]).join(', ').substring(0, 100)}...`);
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
    // 1. Ensure lang is a string and supported, otherwise fallback to 'vi'
    let targetLang = (typeof lang === 'string' && ['vi', 'en'].includes(lang.toLowerCase())) 
        ? lang.toLowerCase() 
        : 'vi';

    if (!translations[targetLang]) {
        // Try to reload once if missing
        if (Object.keys(translations).length === 0) loadTranslations();
        if (!translations[targetLang]) {
            // If still missing after reload, fallback to 'vi' if not already 'vi'
            if (targetLang !== 'vi') targetLang = 'vi';
            if (!translations[targetLang]) return key; // Ultimate fallback: return key
        }
    }

    let value = getNestedValue(translations[targetLang], key);

    if (value === undefined) {
        console.warn(`[i18n] Key NOT found: "${key}" for lang: "${targetLang}"`);
        // Fallback to Vietnamese if not found in English
        if (targetLang !== 'vi') {
            value = getNestedValue(translations['vi'], key);
            if (value) console.log(`[i18n] Fallback to 'vi' for key: "${key}"`);
        }
        
        if (value === undefined) {
            return key; // Return the key itself instead of null to prevent validation errors
        }
    }

    // Basic interpolation: replace {{var}} with data[var]
    if (typeof value === 'string') {
        Object.keys(data).forEach(dataKey => {
            const regex = new RegExp(`{{${dataKey}}}`, 'g');
            // Use fallback empty string for missing data to avoid "undefined" in text
            const replacement = data[dataKey] !== undefined ? data[dataKey] : '';
            value = value.replace(regex, replacement);
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
