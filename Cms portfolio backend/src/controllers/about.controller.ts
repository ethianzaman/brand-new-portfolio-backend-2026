import { Request, Response } from "express";
import { About, IEducation, IExperience, IValue } from "../models/About";
import mongoose from "mongoose";
import { uploadToCloudinary } from "../middleware/uploadMiddleware";
import { publishChange } from "../lib/publish";

// GET /api/about — public
export async function getAbout(req: Request, res: Response): Promise<void> {
  try {
    let about = await About.findOne();
    if (!about) {
      // Auto-create with defaults on first request
      about = await About.create({
        hero: {
          name: "Your Name",
          title: "Full Stack Developer",
          subtitle: "Building great web products",
          bio: ["Your bio here."],
          image: null,
          resumeUrl: "/resume.pdf",
          location: "Remote",
          experience: "1+ Year",
        },
        experiences: [],
        educations: [],
        values: [],
      });
    }
    res.status(200).json({ success: true, about });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// // PUT /api/about/hero — protected
export async function updateHero(req: Request, res: Response): Promise<void> {
  try {
    let heroData = { ...req.body };

    let finalImageUrl: string | undefined;

    // 1️⃣ File upload case (Cloudinary)
    if (req.file) {
      finalImageUrl = await uploadToCloudinary(
        req.file.buffer,
        "portfolio_hero",
      );
    }

    // 2️⃣ URL case (direct input)
    else if (heroData.image) {
      finalImageUrl = heroData.image;
    }

    // 3️⃣ set final image (overwrite old always)
    if (finalImageUrl) {
      heroData.image = finalImageUrl;
    }

    // cleanup
    delete heroData.imageUrl;

    // 4️⃣ bio parse
    if (heroData.bio && typeof heroData.bio === "string") {
      try {
        const parsedBio = JSON.parse(heroData.bio);
        heroData.bio = Array.isArray(parsedBio) ? parsedBio : [parsedBio];
      } catch {
        heroData.bio = [heroData.bio];
      }
    }

    // 5️⃣ dynamic update
    const updateFields: any = {};

    for (const key in heroData) {
      updateFields[`hero.${key}`] = heroData[key];
    }

    const about = await About.findOneAndUpdate(
      {},
      { $set: updateFields },
      { new: true, upsert: true },
    );
    await publishChange("about");

    res.status(200).json({
      success: true,
      hero: about.hero,
    });
  } catch (err: any) {
    console.error("Hero Update Error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
}

// POST /api/about/experiences — protected
export async function createExperience(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // ১. ফ্রন্টএন্ড থেকে আসা বডি এবং ইউনিক কাস্টম আইডি মার্জ করা
    const newExperience = {
      ...req.body,
      id: `exp-${Date.now()}`,
    };

    // ২. মঙ্গুজ কোয়েরি ($position: 0 এর কারণে এটি অ্যারের শুরুতে পুশ হবে)
    const updatedAbout = await About.findOneAndUpdate(
      {},
      {
        $push: {
          experiences: {
            $each: [newExperience],
            $position: 0,
          },
        },
      },
      { new: true, upsert: true },
    );

    // ৩. রেসপন্সে পুরো 'about' ডকুমেন্ট না পাঠিয়ে শুধু নতুন তৈরি হওয়া আইটেমটি
    // অথবা শুধু আপডেটেড experiences অ্যারেটি পাঠানোই বেস্ট প্র্যাকটিস (ফ্রন্টএন্ড স্টেটের জন্য সুবিধা)
    // ✅ এটা করো
    const savedExp = updatedAbout.experiences[0];

    res.status(201).json({
      success: true,
      message: "Experience created successfully",
      experience: savedExp,
      allExperiences: updatedAbout.experiences, // অপশনাল: ফ্রন্টএন্ডে সরাসরি স্টেট সিঙ্ক করার জন্য
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
// PUT /api/about/experiences/:id — protected

export async function updateExperience(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    // 1️⃣ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid experience ObjectId",
      });
      return;
    }

    // 2️⃣ Validate body
    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        message: "No update data provided",
      });
      return;
    }

    // 3️⃣ Allowed fields (SECURITY LAYER)
    const allowedFields = [
      "role",
      "company",
      "type",
      "period",
      "current",
      "description",
      "tags",
    ];

    const updateFields: Record<string, any> = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[`experiences.$.${field}`] = updateData[field];
      }
    }

    console.log("UPDATE FIELDS:", updateFields);

    // 4️⃣ Prevent silent fail
    if (Object.keys(updateFields).length === 0) {
      res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
      return;
    }

    // 5️⃣ Update using Mongo _id inside array
    const updatedAbout = await About.findOneAndUpdate(
      {
        "experiences._id": new mongoose.Types.ObjectId(id),
      },
      {
        $set: updateFields,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    // 6️⃣ Not found check
    if (!updatedAbout) {
      res.status(404).json({
        success: false,
        message: "Experience not found",
      });
      return;
    }

    // 7️⃣ Extract updated experience
    const updatedExp = updatedAbout.experiences.find(
      (exp: IExperience) => exp._id.toString() === id,
    );

    console.log("UPDATED EXP:", updatedExp);

    // 8️⃣ Response
    res.status(200).json({
      success: true,
      message: "Experience updated successfully",
      experience: updatedExp,
    });
  } catch (error) {
    console.error("UPDATE EXPERIENCE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

// DELETE /api/about/experiences/:id — protected
export async function deleteExperience(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    console.log("DELETE EXPERIENCE ID:", id);

    // 1️⃣ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid experience ObjectId",
      });
      return;
    }

    // 2️⃣ Delete from array using Mongo _id
    const updatedAbout = await About.findOneAndUpdate(
      {
        "experiences._id": new mongoose.Types.ObjectId(id),
      },
      {
        $pull: {
          experiences: {
            _id: new mongoose.Types.ObjectId(id),
          },
        },
      },
      {
        new: true,
      },
    );

    // 3️⃣ Not found check
    if (!updatedAbout) {
      res.status(404).json({
        success: false,
        message: "Experience not found",
      });
      return;
    }

    // 4️⃣ Success response
    res.status(200).json({
      success: true,
      message: "Experience deleted successfully",
    });
  } catch (error) {
    console.error("DELETE EXPERIENCE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

// POST /api/about/educations — protected
export async function createEducation(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const edu = { ...req.body, id: `edu-${Date.now()}` };
    const about = await About.findOneAndUpdate(
      {},
      { $push: { educations: { $each: [edu], $position: 0 } } },
      { new: true, upsert: true },
    );
    // ✅ MongoDB-generated _id সহ actual saved object return করো
    const savedEdu = about.educations[0]; // position: 0 তে push করেছো, তাই
    res.status(201).json({ success: true, education: savedEdu });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// UPDATE /api/about/educations/:id — protected

export const updateEducation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    // 1️⃣ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid education ObjectId",
      });
      return;
    }

    // 2️⃣ Check empty body
    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        message: "No update data provided",
      });
      return;
    }

    // 3️⃣ Allowed fields (SECURITY LAYER)
    const allowedFields = [
      "degree",
      "school",
      "period",
      "description",
      "grade",
    ];

    const updateFields: Record<string, any> = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[`educations.$[edu].${field}`] = updateData[field];
      }
    }

    console.log("UPDATE FIELDS:", updateFields);

    // 4️⃣ Prevent silent fail (IMPORTANT)
    if (Object.keys(updateFields).length === 0) {
      res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
      return;
    }

    // 5️⃣ Update document (SAFE ARRAY MATCH)
    // const updatedAbout = await About.findOneAndUpdate(
    //   {
    //     "educations._id": new mongoose.Types.ObjectId(id),
    //   },
    //   {
    //     $set: updateFields,
    //   },
    //   {
    //     new: true,
    //     runValidators: true,
    //   },
    // );

    const updatedAbout = await About.findOneAndUpdate(
      {},
      {
        $set: updateFields,
      },
      {
        new: true,
        runValidators: true,
        arrayFilters: [
          {
            "edu._id": new mongoose.Types.ObjectId(id),
          },
        ],
      },
    );

    // 6️⃣ Not found check
    if (!updatedAbout) {
      res.status(404).json({
        success: false,
        message: "Education not found",
      });
      return;
    }

    // 7️⃣ Extract updated education
    const updatedEdu = updatedAbout.educations.find(
      (edu: IEducation) => edu._id.toString() === id,
    );

    console.log("UPDATED EDU:", updatedEdu);

    // 8️⃣ Success response
    // res.status(200).json({
    //   success: true,
    //   message: "Education updated successfully",
    //   education: updatedEdu,qszx
    // });
    res.status(200).json({
      success: true,
      message: "Education updated successfully",
      education: JSON.parse(JSON.stringify(updatedEdu)),
    });
  } catch (error) {
    console.error("UPDATE EDUCATION ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// DELETE /api/about/educations/:id — protected

export async function deleteEducation(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    console.log("DELETE EDUCATION ID:", id);

    // 1️⃣ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid education ObjectId",
      });
      return;
    }

    // 2️⃣ Delete from nested array safely
    const updatedAbout = await About.findOneAndUpdate(
      {
        "educations._id": new mongoose.Types.ObjectId(id),
      },
      {
        $pull: {
          educations: {
            _id: new mongoose.Types.ObjectId(id),
          },
        },
      },
      {
        new: true,
      },
    );

    // 3️⃣ Not found check
    if (!updatedAbout) {
      res.status(404).json({
        success: false,
        message: "Education not found",
      });
      return;
    }

    // console.log("UPDATED EDUCATIONS:", updatedAbout.educations);

    // 4️⃣ Success response
    res.status(200).json({
      success: true,
      message: "Education deleted successfully",
    });
  } catch (error) {
    console.error("DELETE EDUCATION ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

// POST /api/about/values — protected
export async function createValue(req: Request, res: Response): Promise<void> {
  try {
    const val = { ...req.body, _id: new mongoose.Types.ObjectId() };
    const about = await About.findOneAndUpdate(
      {},
      { $push: { values: val } },
      { new: true, upsert: true },
    );
    res.status(201).json({
      success: true,
      message: "Value created successfully",
      value: val,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

//PUT /api/about/values/:id — protected
export async function updateValue(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // ✅ 1. Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid value ObjectId" });
      return;
    }

    // ✅ 2. Allowed fields (security layer)
    const allowedFields = ["icon", "title", "desc"];
    const updateFields: Record<string, string> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields[`values.$.${field}`] = req.body[field];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      res
        .status(400)
        .json({ success: false, message: "No valid fields to update" });
      return;
    }

    // ✅ 3. ObjectId convert করে query
    const about = await About.findOneAndUpdate(
      { "values._id": new mongoose.Types.ObjectId(id) },
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    // ✅ 4. null check আগে
    if (!about) {
      res.status(404).json({ success: false, message: "Value not found" });
      return;
    }

    // ✅ 5. Type safe find — IValue import না লাগলেও হবে
    const updated = about.values.find((v: IValue) =>
      v._id.equals(new mongoose.Types.ObjectId(id)),
    );

    res.status(200).json({ success: true, value: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message });
  }
}

// DELETE /api/about/values/:id — protected
// export async function deleteValue(req: Request, res: Response): Promise<void> {
//   try {
//     await About.findOneAndUpdate(
//       {},
//       { $pull: { values: { id: req.params.id } } },
//     );
//     res.status(200).json({ success: true, message: "Value deleted" });
//   } catch {
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// }

export async function deleteValue(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // ✅ 1. Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid value ObjectId" });
      return;
    }

    // ✅ 2. _id দিয়ে match, id দিয়ে নয়
    const updatedAbout = await About.findOneAndUpdate(
      { "values._id": new mongoose.Types.ObjectId(id) },
      { $pull: { values: { _id: new mongoose.Types.ObjectId(id) } } },
      { new: true },
    );

    // ✅ 3. Not found check
    if (!updatedAbout) {
      res.status(404).json({ success: false, message: "Value not found" });
      return;
    }

    res
      .status(200)
      .json({ success: true, message: "Value deleted successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message });
  }
}
