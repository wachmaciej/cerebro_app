from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, func, JSON
from sqlalchemy.orm import relationship
from database import Base

class Schedule(Base):
    __tablename__ = "schedules"
    __table_args__ = {"schema": "cerebro"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    marketplace = Column(String)  # e.g., 'US', 'UK'
    cron_expression = Column(String)  # e.g., '0 0 1 * *'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    executions = relationship("ExecutionLog", back_populates="schedule")

class ExecutionLog(Base):
    __tablename__ = "execution_logs"
    __table_args__ = {"schema": "cerebro"}

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("cerebro.schedules.id"), nullable=True)
    status = Column(String)  # 'QUEUED', 'IN_PROGRESS', 'SUCCESS', 'FAILED'
    marketplace = Column(String)
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)
    log_output = Column(String, nullable=True)
    
    schedule = relationship("Schedule", back_populates="executions")

class AsinTrack(Base):
    __tablename__ = "asin_tracks"
    __table_args__ = {"schema": "cerebro"}
    
    id = Column(Integer, primary_key=True, index=True)
    asin = Column(String, index=True)
    marketplace = Column(String)
    tags = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())

class Setting(Base):
    __tablename__ = "settings"
    __table_args__ = {"schema": "cerebro"}

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, index=True, unique=True)
    value = Column(String)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

