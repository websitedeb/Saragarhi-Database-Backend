import { Hono } from 'hono'
import { cors } from 'hono/cors'
import bcrypt from 'bcryptjs'

const app = new Hono()

app.use('*', cors())

app.put('/addUser', async (c) => {
  const body = await c.req.json()
  const { email, name, teamCode, Password } = body

  if (!email || !name || !teamCode || !Password) {
    return c.json({ success: false, error: 'All fields are required' }, 400)
  }

  const checkUser = await c.env.DB.prepare(
    'SELECT * FROM Users WHERE Email = ?')
    .bind(email)
    .first();

  const teamCheck = await c.env.DB.prepare(
    'SELECT * FROM Teams WHERE "Team Code" = ?'
  ).bind(teamCode).first();

  if (checkUser) {
    return c.json({ success: false, error: 'User already exists' }, 409)
  }

  if (!teamCheck) {
    return c.json({ success: false, error: 'Team does not exist' }, 404)
  }

  const hashedPassword = await bcrypt.hash(Password, 10)

  const result = await c.env.DB.prepare(
    'INSERT INTO Users (Email, Name, "Team Code", Password) VALUES (?, ?, ?, ?)'
    )
    .bind(email, name, teamCode, hashedPassword)
    .all();

  if (result.error) {
    return c.json({ success: false, error: 'Failed to add user' }, 500)
  }
  else{
    return c.json({ success: true, result })
  }
});

app.post('/getUser', async (c) => {
  const { email, Password } = await c.req.json();
  if (!email || !Password) {
    return c.json({ success: false, error: 'Email and Password are required' }, 400)
  }

  const pw = await c.env.DB.prepare(
    'SELECT * FROM Users WHERE Email = ?'
  ).bind(email).first();

  if (!pw) {
    return c.json({ error: 'User not found' }, 404)
  }

  const isValid = await bcrypt.compare(Password, pw.Password);

  if (!isValid) {
    return c.json({ success: false, error: 'Invalid password' + pw.Password }, 401)
  }
  else{
    const payload = {
      Email: email,
      TeamCode: pw['Team Code'],
      Name: pw.Name,
      Password: pw.Password
    }

    return c.json({ success: true, message: 'User authenticated successfully', data: payload });
  }
});

app.post("/addTeam", async (c) => {
  const body = await c.req.json();
  const { teamCode, teamNum, teamName} = body;

  if (!teamCode || !teamNum || !teamName) {
    return c.json({ success: false, error: 'All fields are required' }, 400);
  }
  const result = await c.env.DB.prepare(
    'INSERT INTO Teams ("Team Code", "Number", "Name", "DataSetOne", "DataSetTwo", "DataSetThree", "DataSetFour", "DataSetFive", "DataSetSix", "DataSetSeven", "DataSetEight", "DataSetNine", "DataSetTen") VALUES (?, ?, ?, "", "", "", "", "", "", "", "", "", "")'
  ).bind(teamCode, teamNum, teamName).all();

  if (result.error) {
    return c.json({ success: false, error: 'Failed to add team' }, 500);
  } else {
    const check = await c.env.DB.prepare(
      'SELECT * FROM UnNamed WHERE "Team Number" = ?'
    ).bind(teamNum).first();
    if (check) {
      await c.env.DB.prepare(
        'DELETE FROM UnNamed WHERE "Team Number" = ?'
      ).bind(teamNum).run();
    }
    return c.json({ success: true, result });
  }
});

app.post('/getTeam', async (c) => {
  const { teamNum } = await c.req.json();

  if (!teamNum) {
    return c.json({ success: false, error: 'Team number is required' }, 400);
  }

  const team = await c.env.DB.prepare(
    'SELECT * FROM Teams WHERE Number = ?'
  ).bind(teamNum).first();

  if (!team) {
    const TEAM = await c.env.DB.prepare(
      'SELECT * FROM UnNamed WHERE "Team Number" = ?'
    ).bind(teamNum).first();
    if (!TEAM) {
      return c.json({ success: false, error: 'Team not found' }, 404);
    }
    return c.json({ success: true, team: TEAM });
  }
  else{
    return c.json({ success: true, team });
  }

});

app.post('/addReport', async c => {
  const body = await c.req.json();
  const { NumberOfDataSets, TeamNumber } = body;
  
  let sets = [];
  let values = [];

  const dataSetColumns = ["DataSetOne", "DataSetTwo", "DataSetThree", "DataSetFour", "DataSetFive", "DataSetSix", "DataSetSeven", "DataSetEight", "DataSetNine", "DataSetTen"];
  const keys = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

  for (let i = 0; i < NumberOfDataSets; i++) {
    const key = keys[i];
    const entry = body[key];
    if (!entry) continue;

    const [type, value] = entry;
    const column = dataSetColumns[i];

    switch (type) {
      case "text":
        sets.push(`${column} = ?`);
        values.push(value);
        break;
      case "number":
        sets.push(`${column} = ${column} + ?`);
        values.push(value);
        break;
      case "avg":
        sets.push(`${column} = (${column} + ?)/2`);
        values.push(value);
        break;
    }
  }

  const check = await c.env.DB.prepare(`SELECT * FROM Teams WHERE Number = ?`).bind(TeamNumber).first();
  
  if (check) {
    const sql = `
      UPDATE Teams
      SET ${sets.join(", ")}
      WHERE Number = ?
    `;

    values.push(TeamNumber);

    const res = await c.env.DB.prepare(sql).bind(...values).run();

    if (res.error) {
      return c.json({ success: false, error: 'Internal Database Error' }, 500);
    }
    else{
      return c.json({ success: true, message: 'added new dataset(s)' }, 200);
    }
  } else {
    const check2 = await c.env.DB.prepare(`SELECT * FROM "UnNamed" WHERE "Team Number" = ?`).bind(TeamNumber).first();
    if (check2) {
      const sql = `
        UPDATE "UnNamed"
        SET ${sets.join(", ")}
        WHERE "Team Number" = ?
      `;
      values.push(TeamNumber);

      const res = await c.env.DB.prepare(sql).bind(...values).run();
      if (res.error) {
        return c.json({ success: false, error: 'Internal Database Error' }, 500);
      }
      else{
        return c.json({ success: true, message: 'added new dataset(s)' }, 200);
      }
    } else {
      const sql = `
        INSERT INTO "UnNamed" ("Team Number", ${dataSetColumns.slice(0, sets.length).join(", ")}) VALUES (?, ${sets.map(() => '?').join(", ")})
      `;
      values.unshift(TeamNumber);
      const res = await c.env.DB.prepare(sql).bind(...values).run();
      if (res.error) {
        return c.json({ success: false, error: 'Internal Database Error' }, 500);
      } else{
        return c.json({ success: true, message: 'added new dataset(s)' }, 200);
      }
    }
  }
});

app.post("/getStatsOfTeam", async c => {
  const { teamNum } = await c.req.json();

  if (!teamNum) {
    return c.json({ success: false, error: 'Team number is required' }, 400);
  }

  const team = await c.env.DB.prepare(
    'SELECT * FROM Teams WHERE Number = ?'
  ).bind(teamNum).first();

  if (!team) {
    const TEAM = await c.env.DB.prepare(
      'SELECT * FROM UnNamed WHERE "Team Number" = ?'
    ).bind(teamNum).first();

    if (!TEAM) {
      return c.json({ success: false, error: 'Team has not data currently' }, 404);
    }

    const {DataSetOne, DataSetTwo, DataSetThree, DataSetFour, DataSetFive, DataSetSix, DataSetSeven, DataSetEight, DataSetNine, DataSetTen} = TEAM;
    return c.json({ success: true,  DataSetOne: DataSetOne, DataSetTwo: DataSetTwo, DataSetThree: DataSetThree, DataSetFour: DataSetFour, DataSetFive: DataSetFive, DataSetSix: DataSetSix, DataSetSeven: DataSetSeven, DataSetEight: DataSetEight, DataSetNine: DataSetNine, DataSetTen: DataSetTen });
  }
  else{
    const {DataSetOne, DataSetTwo, DataSetThree, DataSetFour, DataSetFive, DataSetSix, DataSetSeven, DataSetEight, DataSetNine, DataSetTen} = team;
    return c.json({ success: true,  DataSetOne: DataSetOne, DataSetTwo: DataSetTwo, DataSetThree: DataSetThree, DataSetFour: DataSetFour, DataSetFive: DataSetFive, DataSetSix: DataSetSix, DataSetSeven: DataSetSeven, DataSetEight: DataSetEight, DataSetNine: DataSetNine, DataSetTen: DataSetTen });
  }
});

export default app;