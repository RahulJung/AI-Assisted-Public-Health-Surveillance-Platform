from datetime import date


def build_hl7_message(record: dict, message_id: str) -> str:
    patient_id = f"P{record['facility_id']:02d}{record['day_index']:03d}{record['row_index']:04d}"
    visit_id = f"V{record['day_index']:03d}{record['row_index']:04d}"
    dob_year = {"0-4": 2022, "5-17": 2012, "18-49": 1988, "50-64": 1968, "65+": 1942}.get(record["age_group"], 1980)
    dob = f"{dob_year}0101"
    result = "POS" if record["test_result"] == "positive" else "NEG"
    complaint = record.get("chief_complaint") or ""
    diagnosis_code = record.get("diagnosis_code") or ""
    syndrome = record.get("syndrome") or "Unknown/Other"
    report_dt = record.get("report_datetime", record["date"])
    return "\r".join(
        [
            f"MSH|^~\\&|EHR|{record['facility']}|PHA|{record['region']}|{report_dt.strftime('%Y%m%d%H%M')}||ADT^A01|{message_id}|P|2.5",
            f"PID|1||{patient_id}||RESEARCH^PATIENT||{dob}|U",
            f"PV1|1|E|ED^{record['facility']}^^{record['region']}||||||||||||||||{visit_id}",
            f"OBX|1|TX|CC||{complaint.upper()}||||||F",
            f"OBX|2|ST|TEST_RESULT||{result}||||||F",
            f"DG1|1||{diagnosis_code}||{syndrome}",
        ]
    )


def parse_hl7_message(raw_message: str) -> dict:
    segments = [line for line in raw_message.replace("\n", "\r").split("\r") if line.strip()]
    payload: dict[str, dict] = {}
    issues: list[str] = []

    for segment in segments:
        fields = segment.split("|")
        name = fields[0]
        payload.setdefault(name, {})
        if name == "MSH":
            payload[name] = {
                "sending_application": fields[2] if len(fields) > 2 else None,
                "sending_facility": fields[3] if len(fields) > 3 else None,
                "message_datetime": fields[6] if len(fields) > 6 else None,
                "message_type": fields[8] if len(fields) > 8 else None,
                "message_control_id": fields[9] if len(fields) > 9 else None,
            }
        elif name == "PID":
            payload[name] = {
                "patient_id": fields[3] if len(fields) > 3 else None,
                "birth_date": fields[7] if len(fields) > 7 else None,
                "administrative_sex": fields[8] if len(fields) > 8 else None,
            }
        elif name == "PV1":
            location = (fields[3] if len(fields) > 3 else "").split("^")
            payload[name] = {
                "patient_class": fields[2] if len(fields) > 2 else None,
                "point_of_care": location[0] if location else None,
                "facility": location[1] if len(location) > 1 else None,
                "region": location[3] if len(location) > 3 else None,
                "visit_number": fields[19] if len(fields) > 19 else None,
            }
        elif name == "OBX":
            observation = fields[3] if len(fields) > 3 else "UNKNOWN"
            payload.setdefault("OBX", {})[observation] = fields[5] if len(fields) > 5 else None
        elif name == "DG1":
            payload[name] = {
                "diagnosis_code": fields[3] if len(fields) > 3 else None,
                "diagnosis_description": fields[5] if len(fields) > 5 else fields[4] if len(fields) > 4 else None,
            }

    required = ["MSH", "PID", "PV1", "OBX", "DG1"]
    for segment in required:
        if segment not in payload:
            issues.append(f"Missing {segment} segment")
    if not (payload.get("OBX", {}).get("CHIEF_COMPLAINT") or payload.get("OBX", {}).get("CC")):
        issues.append("Missing chief complaint observation")
    if not payload.get("DG1", {}).get("diagnosis_code"):
        issues.append("Missing diagnosis code")

    payload["validation_status"] = "valid" if not issues else "review"
    payload["missing_field_checks"] = issues
    payload["data_quality_issues"] = issues or ["No structural issues detected in synthetic message"]
    return payload


def age_group_from_birth_date(birth_date: str | None, reference_date: date) -> str:
    if not birth_date or len(birth_date) < 4:
        return "Unknown"
    age = reference_date.year - int(birth_date[:4])
    if age < 5:
        return "0-4"
    if age < 18:
        return "5-17"
    if age < 50:
        return "18-49"
    if age < 65:
        return "50-64"
    return "65+"
