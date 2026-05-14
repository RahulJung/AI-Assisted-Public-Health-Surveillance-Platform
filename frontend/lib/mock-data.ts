export const regions = ["Region_1", "Region_2", "Region_3", "Region_4", "Region_5"];
export const facilities = Array.from({ length: 20 }, (_, index) => `Facility_${String(index + 1).padStart(2, "0")}`);
export const syndromes = ["Respiratory", "Influenza-like Illness", "Gastrointestinal", "Fever", "Neurological", "Heat-related Illness", "Injury", "Unknown/Other"];
export const ageGroups = ["0-4", "5-17", "18-49", "50-64", "65+"];

export const trendFallback = Array.from({ length: 60 }, (_, index) => {
  const respiratoryBump = index > 42 ? (index - 42) * 18 : 0;
  return {
    date: `Day ${index + 1}`,
    ed_visits: 720 + Math.round(Math.sin(index / 4) * 55) + respiratoryBump,
    test_positivity: 0.08 + (index > 40 ? (index - 40) * 0.006 : 0),
    hospitalizations: 42 + Math.round(Math.max(0, index - 48) * 1.7),
    deaths: 2 + Math.round(Math.max(0, index - 55) * 0.4)
  };
});

export const dashboardFallback = {
  trends: trendFallback,
  syndromes: syndromes.flatMap((syndrome, sIndex) =>
    trendFallback.slice(-25).map((point, index) => ({
      date: point.date,
      syndrome,
      ed_visits: Math.round(point.ed_visits / 10 + sIndex * 8 + Math.sin(index / 3) * 12)
    }))
  ),
  regional: regions.map((region, index) => ({ region, ed_visits: 8200 + index * 720 })),
  facilities: facilities.slice(0, 10).map((facility, index) => ({ facility, ed_visits: 1800 - index * 85 })),
  age_groups: ageGroups.map((age_group, index) => ({ age_group, ed_visits: 4200 + index * 510 }))
};

export const summaryFallback = {
  ed_visits: 1412,
  test_positivity: 0.184,
  hospitalizations: 86,
  deaths: 5,
  active_regions: 5,
  facilities: 20
};

export const anomaliesFallback = [
  {
    id: 1,
    metric_date: "2026-05-10",
    region: "Region_3",
    facility: "Facility_03",
    syndrome: "Respiratory",
    age_group: "65+",
    anomaly_score: 13.4,
    severity_score: 16.2,
    severity: "Critical",
    signal_type: "likely true outbreak",
    models_flagged: ["Rolling 7/14-day z-score", "Isolation Forest", "EWMA acceleration", "test positivity lead indicator"],
    model_metrics: { z_score_7: 4.1, z_score_14: 3.6, isolation_score: 0.71, ewma_delta: 12.4, dbscan_cluster: -1, model_agreement: 4, affected_facilities: 4, affected_age_groups: 3, test_positivity_pct_change: 0.42, hospitalization_pct_change: 0.58, data_quality_flags: [] },
    explanation: "Respiratory activity exceeded rolling baseline after earlier test positivity growth, with older adults and children most affected."
  },
  {
    id: 2,
    metric_date: "2026-05-08",
    region: "Region_1",
    facility: "Facility_06",
    syndrome: "Gastrointestinal",
    age_group: "18-49",
    anomaly_score: 6.1,
    severity_score: 8.4,
    severity: "High",
    signal_type: "likely true outbreak",
    models_flagged: ["DBSCAN", "EWMA acceleration"],
    model_metrics: { z_score_7: 1.9, z_score_14: 2.2, isolation_score: 0.54, ewma_delta: 5.2, dbscan_cluster: -1, model_agreement: 2, affected_facilities: 3, affected_age_groups: 3, data_quality_flags: [] },
    explanation: "Gradual gastrointestinal increase with facility-level contribution above peer facilities."
  }
];

export const hl7Fallback = `MSH|^~\\&|EHR|Facility_12|PHA|Region_3|202605141200||ADT^A01|MSG00001|P|2.5\rPID|1||P12345||RESEARCH^PATIENT||19800101|U\rPV1|1|E|ED^Facility_12^^Region_3||||||||||||||||V0010001\rOBX|1|TX|CC||FEVER COUGH SHORTNESS OF BREATH||||||F\rOBX|2|ST|TEST_RESULT||POS||||||F\rDG1|1||J11.1||Influenza-like Illness`;
