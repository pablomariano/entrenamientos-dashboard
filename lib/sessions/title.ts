const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function timeOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return "por la mañana";
  if (hour >= 12 && hour < 18) return "por la tarde";
  return "por la noche";
}

/**
 * Genera el título descriptivo de una sesión a partir de su fecha.
 * Ej: "Martes 22 de agosto por la mañana"
 */
export function generateSessionTitle(date: Date): string {
  const day = DAYS[date.getDay()];
  const dayNum = date.getDate();
  const month = MONTHS[date.getMonth()];
  const franja = timeOfDay(date.getHours());

  const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1);
  return `${dayCapitalized} ${dayNum} de ${month} ${franja}`;
}
