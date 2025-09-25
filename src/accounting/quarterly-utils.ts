// src/accounting/quarterly-utils.ts
export interface Quarter {
  year: number;
  quarter: number;
  label: string;
  startDate: string;
  endDate: string;
}

export function getCurrentQuarter(): Quarter {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // getMonth() returns 0-11
  const quarter = Math.ceil(month / 3);
  
  return {
    year,
    quarter,
    label: `Q${quarter} ${year}`,
    startDate: getQuarterStartDate(year, quarter),
    endDate: getQuarterEndDate(year, quarter)
  };
}

export function getQuarterStartDate(year: number, quarter: number): string {
  const month = (quarter - 1) * 3 + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function getQuarterEndDate(year: number, quarter: number): string {
  const month = quarter * 3;
  const date = new Date(year, month, 0); // Last day of the quarter
  return date.toISOString().slice(0, 10);
}

export function getPreviousQuarter(year: number, quarter: number): Quarter {
  let prevYear = year;
  let prevQuarter = quarter - 1;
  
  if (prevQuarter === 0) {
    prevQuarter = 4;
    prevYear = year - 1;
  }
  
  return {
    year: prevYear,
    quarter: prevQuarter,
    label: `Q${prevQuarter} ${prevYear}`,
    startDate: getQuarterStartDate(prevYear, prevQuarter),
    endDate: getQuarterEndDate(prevYear, prevQuarter)
  };
}

export function getAllQuartersFromStart(startYear: number = 2020): Quarter[] {
  const quarters: Quarter[] = [];
  const currentQuarter = getCurrentQuarter();
  
  for (let year = startYear; year <= currentQuarter.year; year++) {
    const maxQuarter = year === currentQuarter.year ? currentQuarter.quarter : 4;
    for (let quarter = 1; quarter <= maxQuarter; quarter++) {
      quarters.push({
        year,
        quarter,
        label: `Q${quarter} ${year}`,
        startDate: getQuarterStartDate(year, quarter),
        endDate: getQuarterEndDate(year, quarter)
      });
    }
  }
  
  return quarters.reverse(); // Most recent first
}

export function parseQuarterString(quarterString: string): Quarter {
  const [q, year] = quarterString.split(' ');
  const quarter = parseInt(q.replace('Q', ''));
  const yearNum = parseInt(year);
  
  return {
    year: yearNum,
    quarter,
    label: quarterString,
    startDate: getQuarterStartDate(yearNum, quarter),
    endDate: getQuarterEndDate(yearNum, quarter)
  };
}

export function isDateInQuarter(date: string, quarter: Quarter): boolean {
  return date >= quarter.startDate && date <= quarter.endDate;
}