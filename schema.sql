PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE [Teams] ("Team Code" integer PRIMARY KEY,"Number" integer,"Name" text,"DataSetOne" text,"DataSetTwo" text,"DataSetThree" text,"DataSetFour" text,"DataSetFive" text,"DataSetSix" text,"DataSetSeven" text,"DataSetEight" text,"DataSetNine" text,"DataSetTen" text, FinalNotes text);

CREATE TABLE [UnNamed] ("Team Number" integer PRIMARY KEY,"DataSetOne" text,"DataSetTwo" text,"DataSetThree" text,"DataSetFour" text,"DataSetFive" text,"DataSetSix" text,"DataSetSeven" text,"DataSetEight" text,"DataSetNine" text,"DataSetTen" text, FinalNotes text);

CREATE TABLE [Users] ("Email" text PRIMARY KEY,"Name" text,"Team Code" integer,"Password" text,"Role" text,"Time Table" real);