-- Recreate the Users table
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

-- Recreate the Student table
CREATE TABLE IF NOT EXISTS Student (
    user_id VARCHAR(10) PRIMARY KEY,
    enroll_year INT NOT NULL,
    study_status VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

-- Recreate the Activity_record table
CREATE TABLE IF NOT EXISTS Activity_record (
    user_id VARCHAR(10),
    record VARCHAR(30) PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

-- Recreate the History_courses table
CREATE TABLE IF NOT EXISTS History_courses (
    user_id VARCHAR(10),
    record VARCHAR(30) PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES Student (user_id)
);

-- Recreate the Course table
CREATE TABLE IF NOT EXISTS Course (
    cid VARCHAR(10) PRIMARY KEY,
    curversion VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    credit INT NOT NULL,
    instructor VARCHAR(20) NOT NULL,
    classperiod VARCHAR(20)
);

-- Recreate the Registration table
CREATE TABLE IF NOT EXISTS Registration (
    user_id VARCHAR(10),
    course_cid VARCHAR(10),
    PRIMARY KEY (user_id, course_cid),
    FOREIGN KEY (user_id) REFERENCES Student (user_id),
    FOREIGN KEY (course_cid) REFERENCES Course (cid)
);

-- Recreate the Staff table
CREATE TABLE IF NOT EXISTS Staff (
    user_id VARCHAR(10) PRIMARY KEY,
    position VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

-- Recreate the Faculty table
CREATE TABLE IF NOT EXISTS Faculty (
    user_id VARCHAR(10) PRIMARY KEY,
    department VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

-- Recreate the Admin table
CREATE TABLE IF NOT EXISTS Admin (
    user_id VARCHAR(10) PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

-- Recreate the Management table
CREATE TABLE IF NOT EXISTS Management (
    manager_id VARCHAR(10),
    cid VARCHAR(10),
    role VARCHAR(30),
    PRIMARY KEY (manager_id, cid),
    FOREIGN KEY (manager_id) REFERENCES Users (user_id),
    FOREIGN KEY (cid) REFERENCES Course (cid)
);

-- Ensure Semester table is updated with ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS Semester (
    semester_id VARCHAR(10),
    course_cid VARCHAR(10),
    class_period INT,
    PRIMARY KEY (semester_id, course_cid),
    FOREIGN KEY (course_cid) REFERENCES Course (cid) ON DELETE CASCADE
);

-- Recreate the Weeklist table
CREATE TABLE IF NOT EXISTS Weeklist (
    semester_id VARCHAR(10),
    course_cid VARCHAR(10),
    week INT NOT NULL,
    PRIMARY KEY (semester_id, course_cid),
    FOREIGN KEY (course_cid) REFERENCES Course (cid)
);

-- Recreate the Feed_Back table
CREATE TABLE IF NOT EXISTS Feed_Back (
    user_id VARCHAR(10),
    course_cid VARCHAR(10),
    Feed_Back_Des VARCHAR(50),
    PRIMARY KEY (user_id, course_cid),
    FOREIGN KEY (user_id) REFERENCES Student (user_id),
    FOREIGN KEY (course_cid) REFERENCES Course (cid)
);
