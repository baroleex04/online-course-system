CREATE TABLE Users (
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

CREATE TABLE Student (
    user_id VARCHAR(10) PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    password VARCHAR(30) NOT NULL,
    email VARCHAR(30) NOT NULL,
    pnumber BIGINT NOT NULL,
    nationality VARCHAR(20) NOT NULL,
    fname VARCHAR(30) NOT NULL,
    mname VARCHAR(30),
    lname VARCHAR(30) NOT NULL,
    Enroll_year INT NOT NULL,
    Study_status VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

CREATE TABLE Activity_record (
    user_id VARCHAR(10),
    record VARCHAR(30) PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

CREATE TABLE History_courses (
    user_id VARCHAR(10),
    record VARCHAR(30) PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES Student (user_id)
);

CREATE TABLE Course (
    cid VARCHAR(10) PRIMARY KEY,
    curversion VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    credit INT NOT NULL,
    instructor VARCHAR(20) NOT NULL,
    classperiod VARCHAR(20)
);

CREATE TABLE Registration (
    user_id VARCHAR(10),
    course_cid VARCHAR(10),
    PRIMARY KEY (user_id, course_cid),
    FOREIGN KEY (user_id) REFERENCES Student (user_id),
    FOREIGN KEY (course_cid) REFERENCES Course (cid)
);

CREATE TABLE Staff (
    user_id VARCHAR(10) PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    password VARCHAR(30) NOT NULL,
    email VARCHAR(30) NOT NULL,
    pnumber BIGINT NOT NULL,
    nationality VARCHAR(20) NOT NULL,
    fname VARCHAR(30) NOT NULL,
    mname VARCHAR(30),
    lname VARCHAR(30) NOT NULL,
    `Position` VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

CREATE TABLE Faculty (
    user_id VARCHAR(10) PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    password VARCHAR(30) NOT NULL,
    email VARCHAR(30) NOT NULL,
    pnumber BIGINT NOT NULL,
    nationality VARCHAR(20) NOT NULL,
    fname VARCHAR(30) NOT NULL,
    mname VARCHAR(30),
    lname VARCHAR(30) NOT NULL,
    Department VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

CREATE TABLE Admin (
    user_id VARCHAR(10) PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    password VARCHAR(30) NOT NULL,
    email VARCHAR(30) NOT NULL,
    pnumber BIGINT NOT NULL,
    nationality VARCHAR(20) NOT NULL,
    fname VARCHAR(30) NOT NULL,
    mname VARCHAR(30),
    lname VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (user_id)
);

CREATE TABLE Management (
    manager_id VARCHAR(10),
    cid VARCHAR(10),
    role VARCHAR(30),
    PRIMARY KEY (manager_id, cid),
    FOREIGN KEY (manager_id) REFERENCES Users (user_id),
    FOREIGN KEY (cid) REFERENCES Course (cid)
);

CREATE TABLE Semester (
    semester_id VARCHAR(10),
    course_cid VARCHAR(10),
    class_period INT,
    PRIMARY KEY (semester_id, course_cid),
    FOREIGN KEY (course_cid) REFERENCES Course (cid) ON DELETE CASCADE
);

CREATE TABLE Weeklist (
    semester_id VARCHAR(10),
    course_cid VARCHAR(10),
    week INT NOT NULL,
    PRIMARY KEY (semester_id, course_cid),
    FOREIGN KEY (course_cid) REFERENCES Course (cid)
);

CREATE TABLE Feed_Back (
    user_id VARCHAR(10),
    course_cid VARCHAR(10),
    Feed_Back_Des VARCHAR(50),
    PRIMARY KEY (user_id, course_cid),
    FOREIGN KEY (user_id) REFERENCES Student (user_id),
    FOREIGN KEY (course_cid) REFERENCES Course (cid)
);
