/**
 * Normaliza una cadena de texto eliminando acentos y tildes.
 * @param {string} str - La cadena a normalizar.
 * @returns {string} - La cadena normalizada en minúsculas.
 */
export const normalizeString = (str) => {
    if (!str) return '';
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};
