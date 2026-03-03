from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ScheduleBase(BaseModel):
    name: str
    marketplace: str
    cron_expression: str
    is_active: bool = True

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class ExecutionLogBase(BaseModel):
    schedule_id: Optional[int] = None
    status: str
    marketplace: str

class ExecutionLogCreate(ExecutionLogBase):
    pass

class ExecutionLog(ExecutionLogBase):
    id: int
    started_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    log_output: Optional[str]
    class Config:
        from_attributes = True

class AsinTrackBase(BaseModel):
    asin: str
    marketplace: str
    tags: Optional[str] = None

class AsinTrackCreate(AsinTrackBase):
    pass

class AsinTrack(AsinTrackBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_asins: int
    total_syncs: int
    success_rate: float
    next_sync: Optional[str]
    next_sync_in: Optional[str] = None
    markets_count: int

class SettingBase(BaseModel):
    key: str
    value: str

class SettingCreate(SettingBase):
    pass

class Setting(SettingBase):
    id: int
    updated_at: datetime
    class Config:
        from_attributes = True

