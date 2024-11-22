-- Users Table
CREATE TABLE IF NOT EXISTS Users (
    user_id VARCHAR(10) PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    password VARCHAR(30) NOT NULL,
    email VARCHAR(30) NOT NULL,
    pnumber BIGINT NOT NULL,
    nationality VARCHAR(20) NOT NULL,
    fname VARCHAR(30) NOT NULL,
    mname VARCHAR(30),
    lname VARCHAR(30) NOT NULL,
    user_type VARCHAR(30) NOT NULL
);

-- Student Table
CREATE TABLE IF NOT EXISTS Student (
    user_id VARCHAR(10) PRIMARY KEY,
    enroll_year INT NOT NULL,
    study_status VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

-- Activity_record Table
CREATE TABLE IF NOT EXISTS Activity_record (
    user_id VARCHAR(10),
    record VARCHAR(255),
    PRIMARY KEY (user_id, record),
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

-- Course Table
CREATE TABLE IF NOT EXISTS Course (
    cid VARCHAR(10) NOT NULL,
    semester VARCHAR(10) NOT NULL,
    name VARCHAR(50) NOT NULL,
    credit INT NOT NULL,
    instructor VARCHAR(20) NOT NULL,
    PRIMARY KEY (cid, semester)
);

-- Registration Table
CREATE TABLE IF NOT EXISTS Registration (
    user_id VARCHAR(10),
    course_cid VARCHAR(10),
    semester VARCHAR(10) NOT NULL,
    PRIMARY KEY (user_id, course_cid, semester),
    FOREIGN KEY (user_id) REFERENCES Student (user_id),
    FOREIGN KEY (course_cid, semester) REFERENCES Course (cid, semester)
);

-- Staff Table
CREATE TABLE IF NOT EXISTS Staff (
    user_id VARCHAR(10) PRIMARY KEY,
    position VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

-- Faculty Table
CREATE TABLE IF NOT EXISTS Faculty (
    user_id VARCHAR(10) PRIMARY KEY,
    department VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

-- Admin Table
CREATE TABLE IF NOT EXISTS Admin (
    user_id VARCHAR(10) PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

-- Management Table
CREATE TABLE IF NOT EXISTS Management (
    manager_id VARCHAR(10),
    cid VARCHAR(10),
    semester VARCHAR(10) NOT NULL,
    role VARCHAR(30),
    PRIMARY KEY (manager_id, cid, semester),
    FOREIGN KEY (manager_id) REFERENCES Users (user_id),
    FOREIGN KEY (cid, semester) REFERENCES Course (cid, semester)
);

-- Timetable Table
CREATE TABLE IF NOT EXISTS Timetable (
    course_cid VARCHAR(10) NOT NULL,
    semester VARCHAR(10) NOT NULL,
    week_day INT NOT NULL CHECK (week_day BETWEEN 2 AND 8),
    class_period INT NOT NULL CHECK (class_period BETWEEN 1 AND 12),
    PRIMARY KEY (course_cid, semester, week_day, class_period),
    FOREIGN KEY (course_cid, semester) REFERENCES Course (cid, semester)
);

-- Feed_Back Table
CREATE TABLE IF NOT EXISTS Feed_Back (
    user_id VARCHAR(10),
    course_cid VARCHAR(10),
    semester VARCHAR(10),
    feedback_des VARCHAR(255), -- Increased size for detailed feedback
    PRIMARY KEY (user_id, course_cid, semester),
    FOREIGN KEY (user_id) REFERENCES Student (user_id),
    FOREIGN KEY (course_cid, semester) REFERENCES Course (cid, semester)
);

-- History_courses Table
CREATE TABLE IF NOT EXISTS History_courses (
    user_id VARCHAR(10),
    course_cid VARCHAR(10) NOT NULL,
    semester VARCHAR(10) NOT NULL,
    PRIMARY KEY (user_id, course_cid, semester),
    FOREIGN KEY (user_id) REFERENCES Student (user_id),
    FOREIGN KEY (course_cid, semester) REFERENCES Course (cid, semester)
);