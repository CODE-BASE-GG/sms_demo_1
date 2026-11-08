CREATE TABLE `Course` (
  `CourseID` int PRIMARY KEY AUTO_INCREMENT,
  `CourseName` varchar(100) UNIQUE NOT NULL
);

CREATE TABLE `Subject` (
  `SubjectID` int PRIMARY KEY AUTO_INCREMENT,
  `SubjectName` varchar(100) NOT NULL
);

CREATE TABLE `CourseSubject` (
  `SubjectID` int NOT NULL,
  `CourseID` int NOT NULL,
  PRIMARY KEY (`CourseID`, `SubjectID`)
);

CREATE TABLE `Teacher` (
  `TeacherID` int PRIMARY KEY AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Email` varchar(100) UNIQUE NOT NULL,
  `Password` varchar(255) NOT NULL
);

CREATE TABLE `Admin` (
  `AdminID` int PRIMARY KEY AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Email` varchar(100) UNIQUE NOT NULL,
  `Password` varchar(255) NOT NULL
);

CREATE TABLE `Section` (
  `SectionID` int PRIMARY KEY AUTO_INCREMENT,
  `CourseID` int NOT NULL,
  `SectionName` varchar(50) NOT NULL
);

CREATE TABLE `SectionSubject` (
  `SectionSubjectID` int PRIMARY KEY AUTO_INCREMENT,
  `SectionID` int NOT NULL,
  `SubjectID` int NOT NULL,
  `TeacherID` int NOT NULL
);

CREATE TABLE `Student` (
  `StudentID` int PRIMARY KEY AUTO_INCREMENT,
  `SectionID` int NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Email` varchar(100) UNIQUE,
  `Status` varchar(20) DEFAULT 'Active'
);

CREATE TABLE `Assessment` (
  `AssessmentID` int PRIMARY KEY AUTO_INCREMENT,
  `SubjectID` int NOT NULL,
  `Title` varchar(100) NOT NULL,
  `MaxScore` decimal(5,2) NOT NULL,
  `AssessmentType` varchar(50) NOT NULL
);

CREATE TABLE `StudentScore` (
  `ScoreID` int PRIMARY KEY AUTO_INCREMENT,
  `AssessmentID` int NOT NULL,
  `StudentID` int NOT NULL,
  `Score` decimal(5,2) NOT NULL,
  `Remarks` varchar(255)
);

CREATE TABLE `Attendance` (
  `AttendanceID` int PRIMARY KEY AUTO_INCREMENT,
  `StudentID` int NOT NULL,
  `SubjectID` int NOT NULL,
  `Date` date NOT NULL,
  `Status` varchar(20) NOT NULL
);

CREATE TABLE `Log` (
  `LogID` int PRIMARY KEY AUTO_INCREMENT,
  `TeacherID` int,
  `AdminID` int,
  `Reason` varchar(255) NOT NULL,
  `ActionType` varchar(10) NOT NULL,
  `AffectedTable` varchar(20) NOT NULL,
  `AffectedRecordID` int NOT NULL,
  `Timestamp` datetime DEFAULT (CURRENT_TIMESTAMP),
  `Status` varchar(10) DEFAULT 'Pending'
);

ALTER TABLE `CourseSubject` ADD FOREIGN KEY (`CourseID`) REFERENCES `Course` (`CourseID`);

ALTER TABLE `CourseSubject` ADD FOREIGN KEY (`SubjectID`) REFERENCES `Subject` (`SubjectID`);

ALTER TABLE `Section` ADD FOREIGN KEY (`CourseID`) REFERENCES `Course` (`CourseID`);

ALTER TABLE `SectionSubject` ADD FOREIGN KEY (`SectionID`) REFERENCES `Section` (`SectionID`);

ALTER TABLE `SectionSubject` ADD FOREIGN KEY (`SubjectID`) REFERENCES `Subject` (`SubjectID`);

ALTER TABLE `SectionSubject` ADD FOREIGN KEY (`TeacherID`) REFERENCES `Teacher` (`TeacherID`);

ALTER TABLE `Student` ADD FOREIGN KEY (`SectionID`) REFERENCES `Section` (`SectionID`);

ALTER TABLE `Assessment` ADD FOREIGN KEY (`SubjectID`) REFERENCES `Subject` (`SubjectID`);

ALTER TABLE `StudentScore` ADD FOREIGN KEY (`AssessmentID`) REFERENCES `Assessment` (`AssessmentID`);

ALTER TABLE `StudentScore` ADD FOREIGN KEY (`StudentID`) REFERENCES `Student` (`StudentID`);

ALTER TABLE `Attendance` ADD FOREIGN KEY (`StudentID`) REFERENCES `Student` (`StudentID`);

ALTER TABLE `Attendance` ADD FOREIGN KEY (`SubjectID`) REFERENCES `Subject` (`SubjectID`);

ALTER TABLE `Log` ADD FOREIGN KEY (`TeacherID`) REFERENCES `Teacher` (`TeacherID`);

ALTER TABLE `Log` ADD FOREIGN KEY (`AdminID`) REFERENCES `Admin` (`AdminID`);
