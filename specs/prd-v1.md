# Saturno

Saturno is used to simplify and speed up the complex task of creating school schedules. You can automatically generate timetables for teachers and classes, taking into account the main existing constraints.


Functional Requirements:

- The entire user facing interface is to be in brazilian portuguese
- The user can configure data for individual entities
    - Teachers
        - Their names can repeat (e.g. two Guilhermes)
        - Time constraint (whole day or specific time of the day)
    - Class slot (time of the day in 24h format)
    - Class subjects (history, geography, mathematics)
    - Relationship between teachers and classes (which classes the teachers teach) (constraint)
    - Constraints (besides teacher <-> class relationship)
        - Time constraints
        - How many class subjects weekly
    - Separation (e.g. Ensino Fundamental EF and Ensino Medio EM) (configurable timetables)
        - These have different time tables
        - e.g., EF has classes starting at 07:00 but EM at 07:30
        - e.g., EF has interval between 9:30 and 10:00 but EM has two, at 08:40 to 08:55 and between 10:35 and 10:50
    - Scholar year or grade
        - part of one of EF or EM or any other configured
    - Solution to the problem: given Teachers, class slots, teacher time constraints, class subjects and their relationship with professors, scholar years, multi dimensional separation between EF and EM, solve for fitting N class subjects of a subject S per week

Technical Requirements:

- The system works exclusively in the web
- All data is configured and saved locally, this way if the user turns off their computer, the data is not lost
- The user can import or export the data to other computers

