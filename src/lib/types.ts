export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
};

export type WorkoutSet = {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  name: string;
  sets: WorkoutSet[];
};

export type Workout = {
  title: string;
  notes: string;
  date: string;
  duration: string;
  distance: string;
  saved: boolean;
  exercises: WorkoutExercise[];
};

export type LogPayload = {
  title: string;
  notes: string;
  date: string;
  durationMinutes?: number;
  distanceKm?: number;
  exercises: {
    name: string;
    sets: { setNumber: number; weight: number; reps: number }[];
  }[];
};
