### System Description

The Student Management System (SMS) is a database-driven system that lets teachers keep the academic records of their students in one organized place. Instead of scattered notebooks and spreadsheets, the SMS stores courses, sections, students, and grades in a structured database where records can be added, corrected, removed, and viewed in sorted order.
How the data is organized. Every section belongs to one course (for example, BSIT), and a course can have many sections. Each section is handled by one teacher and groups a set of students together. Every student can have many grade items, and each grade item is recorded under a subject together with the grade, the total score, the number of absences, and any missing requirements. Teachers manage their students through the sections they handle.
Accountability. Because changing student records is sensitive, the system asks the teacher for a reason when performing important actions such as deleting a student, a section, or a grade item, or editing a grade item. Each reason is stored in a log together with who performed the action, what was done, which record was affected, and when it happened. An administrator reviews the logged reasons and either approves or rejects the flagged actions, which gives the school a reliable audit trail.
Users. The system has two kinds of users:

*       Teacher – registers and logs in, manages sections, students, and grade items, and supplies reasons for sensitive actions.
*       Administrator – reviews the reasons logged by teachers, approves or rejects flagged actions, and accesses the full log for oversight and auditing.

Scope. It keeps the four operation layers (teacher account, section, per-student, and admin operations) together with global reason logging, and develops them into a complete database design: ER model, relational mapping, logical design, physical design, and sample data. Enrollment, class scheduling, and payments are outside the scope of this system.
System Features
Account Management

*       A teacher can register an account using a name, email, and password.
*       A teacher can log in to access only the sections, students, and grades under their handling.
*       An administrator account is separate from teacher accounts and is used for review and oversight.

#### Student Management (First Layer)
*       Add students into a section.
*       Edit student details.
*       Delete students – a reason is required.
*       Sort the viewing of students.
*       A section groups a set of students together, and a teacher manages students through their sections.

#### Section Management (Second Layer)
*       Add sections; every section is tied to a course.
*       Edit section details.
*       Delete sections – a reason is required.
*       Sort the viewing of sections.
*       A course can have multiple sections, and a section is handled by one teacher.

#### Grade Management (Third Layer)
*       Add a grade item together with its subject.
*       Edit grade items – a reason is required.
*       Delete grade items – a reason is required.
*       Sort the viewing of grades.
*       Each grade item holds the subject, grade, total, absences, and missing items of a student.

#### Reason Logging and Maintenance (Global Operations)
*       Store the reasons submitted by teachers for the administrator to review.
*       Log each reason with the teacher, action type, affected record, date and time, and status.
*       Clean or maintain the log after it reaches a certain size.

#### Administrative Oversight (Fourth Layer)
*       Review the reasons logged by teachers for add, edit, and delete actions.
*       Approve or reject flagged actions based on the logged reason.
*       Access the full log for oversight and auditing.
