from dataclasses import dataclass
from datetime import datetime, timedelta
from random import Random

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.models.entities import Facility, ParsedEncounter, SurveillanceMetric, SyntheticHL7Message
from app.services.hl7 import build_hl7_message, parse_hl7_message


REGIONS = ["Region_1", "Region_2", "Region_3", "Region_4", "Region_5"]
SYNDROMES = [
    "Respiratory",
    "Influenza-like Illness",
    "Gastrointestinal",
    "Fever",
    "Neurological",
    "Heat-related Illness",
    "Injury",
    "Unknown/Other",
]
AGE_GROUPS = ["0-4", "5-17", "18-49", "50-64", "65+"]

CHIEF_COMPLAINTS = {
    "Respiratory": ["fever cough shortness of breath", "sore throat congestion cough", "difficulty breathing fever", "cough chest tightness"],
    "Influenza-like Illness": ["fever cough body aches", "chills cough fatigue", "flu like symptoms fever", "fever sore throat myalgia"],
    "Gastrointestinal": ["vomiting diarrhea abdominal pain", "nausea vomiting dehydration", "stomach cramps diarrhea"],
    "Fever": ["fever chills body aches", "high fever weakness"],
    "Neurological": ["headache dizziness confusion", "seizure altered mental status"],
    "Heat-related Illness": ["heat exhaustion dizziness", "dehydration after heat exposure"],
    "Injury": ["fall with arm pain", "motor vehicle accident", "laceration hand injury"],
    "Unknown/Other": ["general weakness", "not feeling well", "medical screening exam"],
}

DIAGNOSIS_CODES = {
    "Respiratory": ["J06.9", "J20.9", "R05.9"],
    "Influenza-like Illness": ["J11.1", "J10.1", "R68.89"],
    "Gastrointestinal": ["A08.4", "K52.9", "R11.2"],
    "Fever": ["R50.9", "B34.9"],
    "Neurological": ["R51.9", "R41.82", "R56.9"],
    "Heat-related Illness": ["T67.5", "E86.0"],
    "Injury": ["S61.4", "S52.5", "V89.2"],
    "Unknown/Other": ["R69", "Z13.9"],
}

SYNDROME_BASE_SHARE = {
    "Respiratory": 0.16,
    "Influenza-like Illness": 0.10,
    "Gastrointestinal": 0.11,
    "Fever": 0.09,
    "Neurological": 0.05,
    "Heat-related Illness": 0.03,
    "Injury": 0.23,
    "Unknown/Other": 0.23,
}
AGE_SHARE = {"0-4": 0.09, "5-17": 0.16, "18-49": 0.39, "50-64": 0.18, "65+": 0.18}


@dataclass(frozen=True)
class FacilityProfile:
    name: str
    region: str
    size: str
    baseline_volume: int
    noise: float


class SurveillanceSimulationEngine:
    def __init__(self, days: int = 180, seed: int = 42):
        self.days = days
        self.rng = Random(seed)
        self.np_rng = np.random.default_rng(seed)
        self.start = datetime.utcnow().date() - timedelta(days=days - 1)

    def facility_profiles(self) -> list[FacilityProfile]:
        sizes = [
            ("large", 360, 0.08),
            ("large", 310, 0.09),
            ("medium", 190, 0.14),
            ("medium", 160, 0.16),
            ("small", 75, 0.28),
        ]
        profiles = []
        for idx in range(20):
            size, baseline, noise = sizes[idx % len(sizes)]
            region = REGIONS[idx % len(REGIONS)]
            profiles.append(FacilityProfile(f"Facility_{idx + 1:02d}", region, size, baseline + (idx % 4) * 12, noise))
        return profiles

    def seasonal_multiplier(self, syndrome: str, day_index: int) -> float:
        winter_wave = 1 + 0.38 * np.cos(2 * np.pi * day_index / 180)
        summer_wave = 1 + 0.65 * np.sin(2 * np.pi * (day_index - 35) / 180)
        mild_cycle = 1 + 0.08 * np.sin(2 * np.pi * day_index / 28)
        if syndrome in ["Respiratory", "Influenza-like Illness"]:
            return winter_wave
        if syndrome == "Heat-related Illness":
            return max(0.35, summer_wave)
        if syndrome == "Gastrointestinal":
            return mild_cycle
        if syndrome == "Injury":
            return 1.0 + 0.04 * np.sin(2 * np.pi * day_index / 7)
        return 1.0

    def outbreak_effects(self, profile: FacilityProfile, syndrome: str, age_group: str, day_index: int) -> tuple[float, float, float, float, list[str], str]:
        visit_multiplier = 1.0
        positivity_shift = 0.0
        hospitalization_multiplier = 1.0
        death_multiplier = 1.0
        flags: list[str] = []
        scenario = "baseline"

        # Scenario 1: respiratory outbreak in Region_3 with positivity -> ED -> hospitalization -> death lag.
        if profile.region == "Region_3" and syndrome in ["Respiratory", "Influenza-like Illness"]:
            onset = 118
            curve = max(0.0, min(1.0, (day_index - onset) / 18))
            if day_index >= onset - 3:
                positivity_shift += 0.16 * max(0.0, min(1.0, (day_index - (onset - 3)) / 14))
                scenario = "respiratory_outbreak_region_3"
            if day_index >= onset:
                age_weight = 1.45 if age_group in ["0-4", "65+"] else 1.12 if age_group in ["5-17", "50-64"] else 0.9
                visit_multiplier += 1.25 * curve * age_weight
            if day_index >= onset + 6:
                hospitalization_multiplier += 0.9 * curve * (1.35 if age_group == "65+" else 1.0)
            if day_index >= onset + 12:
                death_multiplier += 0.75 * curve * (1.8 if age_group == "65+" else 0.8)

        # Scenario 2: GI gradual increase in Region_1, concentrated in three facilities.
        if profile.region == "Region_1" and profile.name in ["Facility_01", "Facility_06", "Facility_11"] and syndrome == "Gastrointestinal":
            onset = 132
            if onset <= day_index <= onset + 28:
                ramp = min(1.0, (day_index - onset) / 14)
                age_weight = 1.4 if age_group in ["0-4", "5-17", "18-49"] else 0.75
                visit_multiplier += 0.95 * ramp * age_weight
                positivity_shift += 0.04 * ramp
                scenario = "gi_gradual_region_1"

        # Scenario 3: reporting artifact at one facility with downtime then catch-up upload.
        if profile.name == "Facility_12" and 145 <= day_index <= 150:
            visit_multiplier *= 0.18
            flags.append("delayed_report")
            scenario = "facility_downtime"
        if profile.name == "Facility_12" and day_index == 151:
            visit_multiplier *= 5.8
            flags.extend(["facility_batch_upload", "delayed_report"])
            scenario = "facility_batch_upload"

        # Scenario 4: older-adult respiratory anomaly with higher hospitalization ratio.
        if profile.region == "Region_4" and syndrome == "Respiratory" and age_group == "65+" and day_index >= 154:
            ramp = min(1.0, (day_index - 154) / 12)
            visit_multiplier += 0.55 * ramp
            hospitalization_multiplier += 1.6 * ramp
            scenario = "older_adult_respiratory_severity"

        return visit_multiplier, positivity_shift, hospitalization_multiplier, death_multiplier, flags, scenario

    def quality_flags(self, profile: FacilityProfile, syndrome: str, day_index: int, base_flags: list[str]) -> list[str]:
        flags = list(base_flags)
        if self.rng.random() < 0.006:
            flags.append("missing_chief_complaint")
        if self.rng.random() < 0.004:
            flags.append("missing_diagnosis")
        if self.rng.random() < 0.003:
            flags.append("inconsistent_label")
        if profile.size == "small" and self.rng.random() < 0.005:
            flags.append("delayed_report")
        return sorted(set(flags))

    def simulate_metric(self, profile: FacilityProfile, syndrome: str, age_group: str, day_index: int) -> dict:
        metric_date = self.start + timedelta(days=day_index)
        weekday = metric_date.weekday()
        weekday_factor = 1.12 if weekday in [0, 1] else 0.92 if weekday in [5, 6] else 1.0
        region_factor = 0.9 + REGIONS.index(profile.region) * 0.06
        age_share = AGE_SHARE[age_group]
        base_mean = profile.baseline_volume * SYNDROME_BASE_SHARE[syndrome] * age_share
        base_mean *= weekday_factor * region_factor * self.seasonal_multiplier(syndrome, day_index)
        visit_multiplier, positivity_shift, hosp_multiplier, death_multiplier, scenario_flags, scenario = self.outbreak_effects(profile, syndrome, age_group, day_index)
        noisy_mean = max(0.05, base_mean * visit_multiplier * self.np_rng.lognormal(0, profile.noise))
        visits = int(self.np_rng.poisson(noisy_mean))

        base_positivity = {
            "Respiratory": 0.09,
            "Influenza-like Illness": 0.12,
            "Gastrointestinal": 0.06,
            "Fever": 0.07,
            "Neurological": 0.03,
            "Heat-related Illness": 0.02,
            "Injury": 0.01,
            "Unknown/Other": 0.025,
        }[syndrome]
        positivity = float(np.clip(self.np_rng.normal(base_positivity + positivity_shift, 0.018), 0.005, 0.85))
        hospitalization_rate = {
            "Respiratory": 0.055,
            "Influenza-like Illness": 0.05,
            "Gastrointestinal": 0.035,
            "Fever": 0.04,
            "Neurological": 0.09,
            "Heat-related Illness": 0.08,
            "Injury": 0.06,
            "Unknown/Other": 0.025,
        }[syndrome] * (1.55 if age_group == "65+" else 1.15 if age_group == "0-4" else 1.0)
        hospitalizations = int(self.np_rng.poisson(max(0.0, visits * hospitalization_rate * hosp_multiplier)))
        deaths = int(self.np_rng.poisson(max(0.0, hospitalizations * 0.045 * death_multiplier * (1.8 if age_group == "65+" else 0.7))))

        flags = self.quality_flags(profile, syndrome, day_index, scenario_flags)
        delay = 0.4 + max(0.0, self.np_rng.normal(0.8, 0.55))
        if "delayed_report" in flags:
            delay += self.rng.choice([2.0, 3.0, 4.0])
        quality_penalty = 0.07 * len(flags) + (0.18 if "facility_batch_upload" in flags else 0)
        return {
            "metric_date": metric_date,
            "region": profile.region,
            "facility": profile.name,
            "syndrome": syndrome,
            "age_group": age_group,
            "ed_visits": visits,
            "test_positivity": round(positivity, 3),
            "hospitalizations": hospitalizations,
            "deaths": deaths,
            "reporting_delay_days": round(delay, 2),
            "data_quality_score": round(max(0.35, 0.98 - quality_penalty), 2),
            "data_quality_flags": flags,
            "scenario": scenario,
            "day_index": day_index,
        }

    def message_records_for_metric(self, metric: dict, facility_id: int) -> list[dict]:
        count = 0
        if metric["ed_visits"] > 0 and (metric["scenario"] != "baseline" or metric["day_index"] % 9 == 0):
            count = min(3, max(1, metric["ed_visits"] // 18 + 1))
        records = []
        for index in range(count):
            flags = list(metric["data_quality_flags"])
            complaint = "" if "missing_chief_complaint" in flags else self.rng.choice(CHIEF_COMPLAINTS[metric["syndrome"]])
            diagnosis = "" if "missing_diagnosis" in flags else self.rng.choice(DIAGNOSIS_CODES[metric["syndrome"]])
            syndrome = self.rng.choice(SYNDROMES) if "inconsistent_label" in flags else metric["syndrome"]
            report_date = metric["metric_date"] + timedelta(days=int(round(metric["reporting_delay_days"])))
            records.append(
                {
                    "date": datetime.combine(metric["metric_date"], datetime.min.time()),
                    "report_datetime": datetime.combine(report_date, datetime.min.time()) + timedelta(hours=12),
                    "report_date": report_date,
                    "facility": metric["facility"],
                    "facility_id": facility_id,
                    "region": metric["region"],
                    "syndrome": syndrome,
                    "age_group": metric["age_group"],
                    "chief_complaint": complaint,
                    "diagnosis_code": diagnosis,
                    "test_result": "positive" if self.rng.random() < metric["test_positivity"] else "negative",
                    "hospitalized": metric["hospitalizations"] > 0 and self.rng.random() < 0.25,
                    "death": metric["deaths"] > 0 and self.rng.random() < 0.12,
                    "data_quality_flags": flags,
                    "day_index": metric["day_index"],
                    "row_index": index,
                }
            )
        if records and self.rng.random() < 0.025:
            duplicate = dict(records[0])
            duplicate["data_quality_flags"] = sorted(set(duplicate["data_quality_flags"] + ["duplicate_message"]))
            records.append(duplicate)
        return records


def ensure_synthetic_data(db: Session, days: int = 180, force: bool = False) -> dict:
    existing = db.query(SurveillanceMetric).count()
    if existing and not force:
        return {"status": "already_loaded", "metrics": existing}
    if force:
        db.query(ParsedEncounter).delete()
        db.query(SyntheticHL7Message).delete()
        db.query(SurveillanceMetric).delete()
        db.query(Facility).delete()
        db.commit()

    engine = SurveillanceSimulationEngine(days=days)
    profile_to_model: dict[str, Facility] = {}
    for profile in engine.facility_profiles():
        facility = Facility(name=profile.name, region=profile.region, size=profile.size, baseline_volume=profile.baseline_volume)
        db.add(facility)
        profile_to_model[profile.name] = facility
    db.flush()

    metric_rows: list[SurveillanceMetric] = []
    message_count = 0
    for day_index in range(days):
        for profile in engine.facility_profiles():
            facility = profile_to_model[profile.name]
            for syndrome in SYNDROMES:
                for age_group in AGE_GROUPS:
                    metric = engine.simulate_metric(profile, syndrome, age_group, day_index)
                    metric_rows.append(
                        SurveillanceMetric(
                            metric_date=metric["metric_date"],
                            region=metric["region"],
                            facility=metric["facility"],
                            syndrome=metric["syndrome"],
                            age_group=metric["age_group"],
                            ed_visits=metric["ed_visits"],
                            test_positivity=metric["test_positivity"],
                            hospitalizations=metric["hospitalizations"],
                            deaths=metric["deaths"],
                            reporting_delay_days=metric["reporting_delay_days"],
                            data_quality_score=metric["data_quality_score"],
                            data_quality_flags=metric["data_quality_flags"],
                            scenario=metric["scenario"],
                        )
                    )
                    for record in engine.message_records_for_metric(metric, facility.id):
                        message_count += 1
                        event_id = f"MSG{message_count:08d}"
                        storage_id = event_id
                        if "duplicate_message" in record["data_quality_flags"]:
                            storage_id = f"{event_id}_DUP"
                        raw = build_hl7_message(record, event_id)
                        message = SyntheticHL7Message(
                            message_control_id=storage_id,
                            event_message_id=event_id,
                            raw_message=raw,
                            encounter_date=metric["metric_date"],
                            report_date=record["report_date"],
                            parsed_status="parsed",
                            data_quality_flags=record["data_quality_flags"],
                        )
                        db.add(message)
                        db.flush()
                        parsed = parse_hl7_message(raw)
                        parsed["data_quality_flags"] = record["data_quality_flags"]
                        db.add(
                            ParsedEncounter(
                                message_id=message.id,
                                encounter_date=metric["metric_date"],
                                report_date=record["report_date"],
                                region=metric["region"],
                                facility=metric["facility"],
                                syndrome=record["syndrome"],
                                age_group=metric["age_group"],
                                chief_complaint=record["chief_complaint"],
                                diagnosis_code=record["diagnosis_code"],
                                test_result=record["test_result"],
                                hospitalized=record["hospitalized"],
                                death=record["death"],
                                data_quality_flags=record["data_quality_flags"],
                                parsed_payload=parsed,
                            )
                        )

    db.bulk_save_objects(metric_rows)
    db.commit()
    return {
        "status": "generated",
        "simulation_engine": "facility-seasonality-lagged-outbreak-quality-artifact",
        "metrics": len(metric_rows),
        "hl7_messages": message_count,
        "regions": len(REGIONS),
        "facilities": len(profile_to_model),
        "syndromes": len(SYNDROMES),
    }


def metrics_dataframe(db: Session) -> pd.DataFrame:
    rows = db.query(SurveillanceMetric).all()
    return pd.DataFrame(
        [
            {
                "date": row.metric_date,
                "region": row.region,
                "facility": row.facility,
                "syndrome": row.syndrome,
                "age_group": row.age_group,
                "ed_visits": row.ed_visits,
                "test_positivity": row.test_positivity,
                "hospitalizations": row.hospitalizations,
                "deaths": row.deaths,
                "reporting_delay_days": row.reporting_delay_days,
                "data_quality_score": row.data_quality_score,
                "data_quality_flags": row.data_quality_flags or [],
                "scenario": row.scenario,
            }
            for row in rows
        ]
    )
