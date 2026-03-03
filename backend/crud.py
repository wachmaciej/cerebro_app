from sqlalchemy.orm import Session
from datetime import datetime
import models, schemas

def get_schedule(db: Session, schedule_id: int):
    return db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()

def get_schedules(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Schedule).offset(skip).limit(limit).all()

def create_schedule(db: Session, schedule: schemas.ScheduleCreate):
    db_schedule = models.Schedule(**schedule.model_dump())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

def update_schedule(db: Session, schedule_id: int, schedule: schemas.ScheduleCreate):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if db_schedule:
        db_schedule.name = schedule.name
        db_schedule.marketplace = schedule.marketplace
        db_schedule.cron_expression = schedule.cron_expression
        db_schedule.is_active = schedule.is_active
        db.commit()
        db.refresh(db_schedule)
    return db_schedule

def toggle_schedule_active(db: Session, schedule_id: int):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if db_schedule:
        db_schedule.is_active = not db_schedule.is_active
        db.commit()
        db.refresh(db_schedule)
    return db_schedule

def delete_schedule(db: Session, schedule_id: int):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if db_schedule:
        db.delete(db_schedule)
        db.commit()
        return True
    return False

def get_asins(db: Session, skip: int = 0, limit: int = 50, marketplace: str = None, search: str = None):
    query = db.query(models.AsinTrack)
    
    if marketplace:
        query = query.filter(models.AsinTrack.marketplace == marketplace)
        
    if search:
        search_term = f"%{search}%"
        # Since tags can be null, we use or_ to search in either column
        from sqlalchemy import or_
        query = query.filter(
            or_(
                models.AsinTrack.asin.ilike(search_term),
                models.AsinTrack.tags.ilike(search_term)
            )
        )
        
    return query.order_by(models.AsinTrack.created_at.desc()).offset(skip).limit(limit).all()

def create_asin(db: Session, asin: schemas.AsinTrackCreate):
    db_asin = models.AsinTrack(**asin.model_dump())
    db.add(db_asin)
    db.commit()
    db.refresh(db_asin)
    return db_asin

def delete_asin(db: Session, asin_id: int):
    db_asin = db.query(models.AsinTrack).filter(models.AsinTrack.id == asin_id).first()
    if db_asin:
        db.delete(db_asin)
        db.commit()
        return True
    return False

def get_logs(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ExecutionLog).order_by(models.ExecutionLog.started_at.desc()).offset(skip).limit(limit).all()

def clear_completed_logs(db: Session):
    result = db.query(models.ExecutionLog).filter(
        models.ExecutionLog.status != "QUEUED"
    ).delete()
    db.commit()
    return result

def create_execution_log(db: Session, log: schemas.ExecutionLogCreate):
    db_log = models.ExecutionLog(**log.model_dump())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def update_execution_log_progress(db: Session, log_id: int, log_output: str):
    db_log = db.query(models.ExecutionLog).filter(models.ExecutionLog.id == log_id).first()
    if db_log:
        db_log.log_output = log_output
        db.commit()

def update_execution_log(db: Session, log_id: int, status: str, error_message: str = None, log_output: str = None):
    db_log = db.query(models.ExecutionLog).filter(models.ExecutionLog.id == log_id).first()
    if db_log:
        db_log.status = status
        db_log.completed_at = datetime.now()
        if error_message:
            db_log.error_message = error_message
        if log_output:
            db_log.log_output = log_output
        db.commit()
        db.refresh(db_log)
    return db_log

def get_setting(db: Session, key: str):
    return db.query(models.Setting).filter(models.Setting.key == key).first()

def set_setting(db: Session, setting: schemas.SettingCreate):
    db_setting = db.query(models.Setting).filter(models.Setting.key == setting.key).first()
    if db_setting:
        db_setting.value = setting.value
        db.commit()
        db.refresh(db_setting)
        return db_setting
    else:
        new_setting = models.Setting(key=setting.key, value=setting.value)
        db.add(new_setting)
        db.commit()
        db.refresh(new_setting)
        return new_setting

def get_dashboard_stats(db: Session):
    from sqlalchemy import func
    
    total_asins = db.query(models.AsinTrack).count()
    markets_count = db.query(func.count(func.distinct(models.AsinTrack.marketplace))).scalar()
    
    total_syncs = db.query(models.ExecutionLog).count()
    success_syncs = db.query(models.ExecutionLog).filter(models.ExecutionLog.status == "SUCCESS").count()
    
    success_rate = (success_syncs / total_syncs * 100) if total_syncs > 0 else 0.0
    
    import datetime
    schedules = db.query(models.Schedule).filter(models.Schedule.is_active == True).all()
    next_sync_time = None
    next_sync_name = None
    
    now = datetime.datetime.now()
    
    for schedule in schedules:
        parts = schedule.cron_expression.split()
        if len(parts) != 5:
            continue
        try:
            minute = int(parts[0])
            hour = int(parts[1])
            dom = parts[2]
            month = parts[3]
            dow = parts[4]
            
            run_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            if run_time <= now:
                run_time += datetime.timedelta(days=1)
                
            if dom != '*' and dow == '*':
                # Monthly
                run_time = now.replace(day=int(dom), hour=hour, minute=minute, second=0, microsecond=0)
                if run_time <= now:
                    try:
                        run_time = run_time.replace(month=run_time.month + 1)
                    except ValueError:
                        run_time = run_time.replace(year=run_time.year + 1, month=1)
            elif dow != '*' and dom == '*':
                # Weekly
                target_dow = int(dow)
                py_target_weekday = target_dow - 1 if target_dow > 0 else 6
                days_ahead = py_target_weekday - run_time.weekday()
                if days_ahead < 0 or (days_ahead == 0 and now.replace(hour=hour, minute=minute, second=0, microsecond=0) <= now):
                    days_ahead += 7
                run_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0) + datetime.timedelta(days=days_ahead)
                
            if not next_sync_time or run_time < next_sync_time:
                next_sync_time = run_time
                next_sync_name = f"{schedule.marketplace} Market"
        except Exception:
            pass
            
    next_sync = next_sync_name if next_sync_name else "No active schedules"
    next_sync_in = "N/A"
    
    if next_sync_time:
        diff = next_sync_time - now
        total_seconds = int(diff.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        if hours >= 24:
            days = hours // 24
            hours_rem = hours % 24
            next_sync_in = f"In {days} days, {hours_rem} hours"
        else:
            next_sync_in = f"In {hours} hours, {minutes} mins"
    
    return {
        "total_asins": total_asins,
        "total_syncs": total_syncs,
        "success_rate": round(success_rate, 1),
        "next_sync": next_sync,
        "next_sync_in": next_sync_in,
        "markets_count": markets_count
    }

def get_unique_marketplaces(db: Session):
    from sqlalchemy import func
    return [m[0] for m in db.query(models.AsinTrack.marketplace).distinct().all()]
