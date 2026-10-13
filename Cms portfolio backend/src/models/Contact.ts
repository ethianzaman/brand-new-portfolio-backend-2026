// import mongoose, { Document, Schema } from 'mongoose'

// export interface IContact extends Document {
//   info: {
//     email: string
//     phone: string
//     location: string
//     responseTime: string
//     available: boolean
//     availableText: string
//     socials: {
//       github: string
//       linkedin: string
//       twitter: string
//     }
//   }

//   faqs: {
//     id: string
//     question: string
//     answer: string
//     order: number
//   }[]
// }

// const FAQSchema = new Schema(
//   {
//     question: {
//       type: String,
//       required: true,
//     },
//     answer: {
//       type: String,
//       required: true,
//     },
//     order: {
//       type: Number,
//       default: 0,
//     },
//   },
//   {
//     _id: true,
//     id: false,
//   }
// )

// FAQSchema.virtual('id').get(function () {
//   return this._id.toString()
// })

// const ContactSchema = new Schema<IContact>(
//   {
//     info: {
//       email: {
//         type: String,
//         required: true,
//       },
//       phone: {
//         type: String,
//         default: '',
//       },
//       location: {
//         type: String,
//         default: '',
//       },
//       responseTime: {
//         type: String,
//         default: 'Within 24 hours',
//       },
//       available: {
//         type: Boolean,
//         default: true,
//       },
//       availableText: {
//         type: String,
//         default: 'Currently accepting work',
//       },
//       socials: {
//         github: {
//           type: String,
//           default: '',
//         },
//         linkedin: {
//           type: String,
//           default: '',
//         },
//         twitter: {
//           type: String,
//           default: '',
//         },
//       },
//     },

//     faqs: {
//       type: [FAQSchema],
//       default: [],
//     },
//   },
//   {
//     timestamps: true,

//     toJSON: {
//       virtuals: true,

//       transform: (_doc, ret) => {
//         const { _id, __v, ...rest } = ret

//         return {
//           ...rest,
//           id: _id.toString(),
//         }
//       },
//     },

//     toObject: {
//       virtuals: true,
//     },
//   }
// )

// ContactSchema.virtual('id').get(function () {
//   return this._id.toString()
// })

// export const Contact =
//   mongoose.models.Contact ||
//   mongoose.model<IContact>('Contact', ContactSchema)



import mongoose, { Document, Schema } from "mongoose";

export interface IContact extends Document {
  info: {
    email: string;
    phone: string;
    location: string;
    responseTime: string;
    available: boolean;
    availableText: string;
    socials: {
      github: string;
      linkedin: string;
      twitter: string;
    };
  };

  faqs: {
    id: string;
    question: string;
    answer: string;
    order: number;
  }[];
}

const FAQSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: true,
    id: false,
    timestamps: false,

    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;

        return {
          id: _id.toString(),
          ...rest,
        };
      },
    },

    toObject: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;

        return {
          id: _id.toString(),
          ...rest,
        };
      },
    },
  }
);

const ContactSchema = new Schema<IContact>(
  {
    info: {
      email: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        default: "",
      },
      location: {
        type: String,
        default: "",
      },
      responseTime: {
        type: String,
        default: "Within 24 hours",
      },
      available: {
        type: Boolean,
        default: true,
      },
      availableText: {
        type: String,
        default: "Currently accepting work",
      },
      socials: {
        github: {
          type: String,
          default: "",
        },
        linkedin: {
          type: String,
          default: "",
        },
        twitter: {
          type: String,
          default: "",
        },
      },
    },

    faqs: {
      type: [FAQSchema],
      default: [],
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;

        return {
          ...rest,
          id: _id.toString(),
        };
      },
    },

    toObject: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: any) => {
        const { _id, __v, ...rest } = ret;

        return {
          ...rest,
          id: _id.toString(),
        };
      },
    },
  }
);

export const Contact =
  mongoose.models.Contact ||
  mongoose.model<IContact>("Contact", ContactSchema);
